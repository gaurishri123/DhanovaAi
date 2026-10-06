"""Graph-based fraud ring detection for Dhanova.

The detector combines seeded Louvain communities with short, high-value
transaction bursts. Louvain is useful for broad graph features, but a whole
payment graph can merge several rings into large communities; temporal burst
candidates preserve the small ring structure used by the simulator.
"""

from datetime import datetime
from typing import Dict, Iterable, List, Optional, Sequence, Set, Tuple

import networkx as nx
import numpy as np
import pandas as pd


RING_COLUMNS = [
    'ring_id', 'members', 'size', 'ring_score', 'total_flow_amount',
    'internal_flow_ratio', 'pass_through', 'time_span_hours',
    'internal_edge_count', 'external_in_amount', 'external_out_amount',
    'candidate_source', 'burst_score', 'flow_balance_score',
]


def build_graph(
    transactions: pd.DataFrame,
    as_of: Optional[datetime] = None,
) -> nx.DiGraph:
    """Build a weighted directed transaction graph."""
    required = {'sender_account_id', 'receiver_account_id', 'amount', 'timestamp'}
    missing = required - set(transactions.columns)
    if missing:
        raise ValueError(f'Missing transaction columns: {sorted(missing)}')

    tx = transactions.copy()
    tx['timestamp'] = pd.to_datetime(tx['timestamp'], utc=True, format='mixed')
    if as_of is not None:
        cutoff = pd.Timestamp(as_of)
        cutoff = cutoff.tz_localize('UTC') if cutoff.tzinfo is None else cutoff.tz_convert('UTC')
        tx = tx[tx['timestamp'] <= cutoff]

    graph = nx.DiGraph()
    if tx.empty:
        return graph

    group_cols = ['sender_account_id', 'receiver_account_id']
    aggregations = {
        'amount': 'sum',
        'timestamp': ['min', 'max'],
    }
    if 'txn_id' in tx.columns:
        aggregations['txn_id'] = 'count'
    else:
        tx = tx.assign(txn_id=1)
        aggregations['txn_id'] = 'sum'

    edge_agg = tx.groupby(group_cols).agg(aggregations).reset_index()
    edge_agg.columns = ['sender', 'receiver', 'weight', 'first_ts', 'last_ts', 'count']
    for row in edge_agg.itertuples(index=False):
        graph.add_edge(
            row.sender,
            row.receiver,
            weight=float(row.weight),
            count=int(row.count),
            first_ts=row.first_ts,
            last_ts=row.last_ts,
        )
    return graph


def detect_communities(G: nx.DiGraph, seed: int = 42) -> List[set]:
    """Detect seeded Louvain communities on an undirected projection."""
    undirected = G.to_undirected()
    if undirected.number_of_nodes() == 0:
        return []
    return nx.community.louvain_communities(undirected, weight='weight', seed=seed)


def find_short_cycles(
    G: nx.DiGraph,
    node_subset: Sequence[str],
    max_len: int = 4,
) -> List[List[str]]:
    """Find directed cycles only inside the supplied suspicious subgraph."""
    if not node_subset:
        return []
    subgraph = G.subgraph(node_subset)
    try:
        return [cycle for cycle in nx.simple_cycles(subgraph, length_bound=max_len)
                if 2 <= len(cycle) <= max_len]
    except nx.NetworkXError:
        return []


def _empty_rings() -> pd.DataFrame:
    return pd.DataFrame(columns=RING_COLUMNS)


def _candidate_stats(
    transactions: pd.DataFrame,
    members: Iterable[str],
    source: str,
    burst_start: Optional[pd.Timestamp] = None,
    burst_end: Optional[pd.Timestamp] = None,
) -> Optional[dict]:
    """Compute transaction-level statistics for one candidate member set."""
    member_set = set(members)
    if len(member_set) < 3:
        return None

    tx = transactions.copy()
    tx['timestamp'] = pd.to_datetime(tx['timestamp'], utc=True, format='mixed')
    if burst_start is not None:
        tx = tx[(tx['timestamp'] >= burst_start) & (tx['timestamp'] <= burst_end)]
    if tx.empty:
        return None

    internal = tx[
        tx['sender_account_id'].isin(member_set)
        & tx['receiver_account_id'].isin(member_set)
    ]
    incident = tx[
        tx['sender_account_id'].isin(member_set)
        | tx['receiver_account_id'].isin(member_set)
    ]
    if internal.empty:
        return None

    external_in = tx[
        (~tx['sender_account_id'].isin(member_set))
        & tx['receiver_account_id'].isin(member_set)
    ]['amount'].sum()
    external_out = tx[
        tx['sender_account_id'].isin(member_set)
        & (~tx['receiver_account_id'].isin(member_set))
    ]['amount'].sum()
    internal_amount = float(internal['amount'].sum())
    total_flow = internal_amount + float(external_in) + float(external_out)
    if total_flow <= 0:
        return None

    timestamps = internal['timestamp']
    span_hours = max(0.0, (timestamps.max() - timestamps.min()).total_seconds() / 3600)
    internal_ratio = internal_amount / total_flow
    pass_through = float(external_out / external_in) if external_in > 0 else 0.0
    flow_balance = 1.0 - min(1.0, abs(float(external_out) - float(external_in)) /
                               max(float(external_out), float(external_in), 1.0))
    burst_score = 1.0 / (1.0 + span_hours / 24.0)
    unique_internal_pairs = internal[['sender_account_id', 'receiver_account_id']].drop_duplicates()
    density = len(unique_internal_pairs) / max(len(member_set) * (len(member_set) - 1), 1)
    activity_score = min(1.0, len(incident) / max(len(member_set) * 2, 1))

    # Candidate score is intentionally archetype-neutral: internal cohesion,
    # temporal concentration and balanced flow are useful for all archetypes.
    score = (
        35.0 * internal_ratio
        + 25.0 * burst_score
        + 20.0 * min(1.0, density * 4.0)
        + 10.0 * flow_balance
        + 10.0 * activity_score
    )
    return {
        'members': sorted(member_set),
        'size': len(member_set),
        'ring_score': float(score),
        'total_flow_amount': float(total_flow),
        'internal_flow_ratio': float(internal_ratio),
        'pass_through': float(min(pass_through, 2.0)),
        'time_span_hours': float(span_hours),
        # Count distinct directed connections for topology gates; repeated
        # transfers increase flow/activity but do not create new structure.
        'internal_edge_count': int(len(unique_internal_pairs)),
        'external_in_amount': float(external_in),
        'external_out_amount': float(external_out),
        'candidate_source': source,
        'burst_score': float(burst_score),
        'flow_balance_score': float(flow_balance),
    }


def _temporal_candidates(
    transactions: pd.DataFrame,
    min_size: int,
    max_size: int,
    account_devices: Optional[pd.DataFrame] = None,
    amount_floor: float = 5000.0,
    window_hours: int = 3,
) -> List[dict]:
    """Find hub, cycle, and shared-device candidates in short time windows."""
    tx = transactions.copy()
    tx['timestamp'] = pd.to_datetime(tx['timestamp'], utc=True, format='mixed')
    # Keep medium/high-value transfers to suppress routine noise. Device-farm
    # rings are recovered separately from their shared-device groups, so the
    # temporal topology stage can use the stronger fraud-ring amount bands.
    tx = tx[tx['amount'] >= amount_floor]
    if tx.empty:
        return []

    start = tx['timestamp'].min().floor('h')
    end = tx['timestamp'].max().ceil('h')
    windows = pd.date_range(start, end, freq='1h')
    candidates: List[dict] = []
    seen: Set[frozenset] = set()

    def add_candidate(members, source, window_start, window_end):
        members = set(members)
        if not (min_size <= len(members) <= max_size):
            return
        key = frozenset(members)
        # Score candidates on the suspicious amount band, not on the full
        # graph's routine low-value traffic. The raw table is still used by
        # the caller for graph construction and feature engineering.
        stats = _candidate_stats(tx, members, source, window_start, window_end)
        if stats is None:
            return
        # Require a connected topology and, for hub candidates, at least four
        # internal transfers. This removes tiny accidental pairs/triangles
        # created by routine traffic while preserving the explicit 3-node cycle
        # fixture and genuine small rings.
        minimum_edges = max(2, len(members) - 1)
        if source == 'fan_out_hub':
            minimum_edges = max(4, minimum_edges)
        elif source == 'fan_in_hub':
            # A collector ring may have two collectors, so its union has one
            # fewer internal edge per collector neighborhood than members.
            minimum_edges = max(2, len(members) - 2)
        if stats['internal_edge_count'] < minimum_edges:
            return
        # Directional rings have a stronger signature than the neutral score
        # alone captures: fan-out has a large external funding transaction,
        # while fan-in has many externally funded mules forwarding inward.
        # Add a bounded, explainable bonus rather than lowering the global
        # quality gates (which would admit ordinary high-degree accounts).
        if source == 'fan_out_hub' and (
            stats['external_in_amount'] >= 50000
            and stats['internal_edge_count'] >= len(members) - 1
        ):
            stats['ring_score'] += 20.0
        elif source == 'fan_in_hub' and (
            stats['external_in_amount'] >= 25000
            and stats['internal_edge_count'] >= len(members) - 2
        ):
            stats['ring_score'] += 15.0
        if key not in seen or source in {'fan_out_hub', 'fan_in_hub', 'cycle'}:
            seen.add(key)
            stats['candidate_source'] = source
            candidates.append(stats)

    for window_start in windows:
        window_end = window_start + pd.Timedelta(hours=window_hours)
        window_tx = tx[(tx['timestamp'] >= window_start) & (tx['timestamp'] <= window_end)]
        if window_tx.empty:
            continue

        directed = nx.DiGraph()
        for row in window_tx.itertuples(index=False):
            if row.sender_account_id != row.receiver_account_id:
                directed.add_edge(row.sender_account_id, row.receiver_account_id)

        # Fan-out/fan-in: use the strongest neighbors of each local hub. Keep
        # only hubs with a clear directional signature; otherwise routine
        # accounts with a few unrelated edges create thousands of candidates.
        edge_strength = window_tx.groupby(
            ['sender_account_id', 'receiver_account_id']
        )['amount'].sum()
        for hub in directed.nodes:
            outgoing = sorted(
                ((neighbor, float(edge_strength.get((hub, neighbor), 0.0)))
                 for neighbor in directed.successors(hub)),
                key=lambda item: item[1], reverse=True,
            )[:max_size - 1]
            incoming = sorted(
                ((neighbor, float(edge_strength.get((neighbor, hub), 0.0)))
                 for neighbor in directed.predecessors(hub)),
                key=lambda item: item[1], reverse=True,
            )[:max_size - 1]
            out_total = sum(amount for _, amount in outgoing)
            in_total = sum(amount for _, amount in incoming)

            # A fan-out hub disperses funds it previously received. It does not
            # need to send out 1.5x what it received; we just need to verify it
            # actually acts as a dispersal hub (sends out a large sum to many).
            if len(outgoing) >= min_size - 1 and out_total >= 20000:
                add_candidate([hub] + [node for node, _ in outgoing], 'fan_out_hub', window_start, window_end)

            # A fan-in collector aggregates funds from many. A ring may use
            # two collectors, so retain the single-hub candidate here and
            # combine compatible collector neighborhoods below.
            if len(incoming) >= min_size - 1 and in_total >= 20000:
                add_candidate([hub] + [node for node, _ in incoming], 'fan_in_hub', window_start, window_end)

        # Fan-in rings can split their mules across two collectors. Combine
        # high-degree collector neighborhoods when the resulting subgraph is
        # still bounded; this recovers the intended ring without accepting the
        # entire weak component (which commonly contains victim accounts).
        collector_neighborhoods = []
        for hub in directed.nodes:
            incoming = sorted(
                ((neighbor, float(edge_strength.get((neighbor, hub), 0.0)))
                 for neighbor in directed.predecessors(hub)),
                key=lambda item: item[1], reverse=True,
            )[:max_size - 1]
            if len(incoming) >= 2 and sum(amount for _, amount in incoming) >= 15000:
                collector_neighborhoods.append(({hub} | {node for node, _ in incoming}, hub))
        for index, (first, first_hub) in enumerate(collector_neighborhoods):
            for second, second_hub in collector_neighborhoods[index + 1:]:
                members = first | second
                if len(members) > max_size:
                    continue
                # Distinct collectors should share a ring mule or be joined
                # by a high-value edge; otherwise pairings are combinatorial
                # noise from unrelated hubs in the same time window.
                shared_mules = (first - {first_hub}) & (second - {second_hub})
                joined = directed.has_edge(first_hub, second_hub) or directed.has_edge(second_hub, first_hub)
                combined_flow = sum(
                    float(edge_strength.get((node, hub), 0.0))
                    for node_set, hub in (collector_neighborhoods[index], (second, second_hub))
                    for node in node_set
                    if node != hub
                )
                # The generator's two collectors may have disjoint mule sets;
                # combined high-value flow is sufficient evidence in that case.
                if shared_mules or joined or combined_flow >= 40000:
                    add_candidate(members, 'fan_in_hub', window_start, window_end)

        # Circular layering: use a longer window and high-value edges so a
        # cycle is not lost inside the much larger routine-traffic component.
        cycle_end = window_start + pd.Timedelta(hours=max(window_hours, 8))
        cycle_tx = tx.copy()
        cycle_tx['timestamp'] = pd.to_datetime(cycle_tx['timestamp'], utc=True, format='mixed')
        cycle_tx = cycle_tx[
            (cycle_tx['timestamp'] >= window_start)
            & (cycle_tx['timestamp'] <= cycle_end)
            & (cycle_tx['amount'] >= 10000)
        ]
        cycle_graph = nx.DiGraph()
        cycle_graph.add_edges_from(
            cycle_tx[['sender_account_id', 'receiver_account_id']]
            .itertuples(index=False, name=None)
        )
        for component in nx.connected_components(cycle_graph.to_undirected()):
            if len(component) > max_size * 2:
                continue
            component_graph = cycle_graph.subgraph(component)
            try:
                # A full simple cycle is the natural candidate for circular
                # layering. Preserve the complete member set rather than
                # letting hub candidates return noisy partial subsets.
                cycles = nx.simple_cycles(component_graph, length_bound=max_size)
                for cycle in cycles:
                    if min_size <= len(cycle) <= max_size:
                        add_candidate(cycle, 'cycle', window_start, cycle_end)
            except nx.NetworkXError:
                continue

        # Shared-device groups are a separate signal from graph topology.
        if account_devices is not None and not account_devices.empty:
            active_accounts = set(window_tx['sender_account_id']) | set(window_tx['receiver_account_id'])
            active_devices = account_devices[account_devices['account_id'].isin(active_accounts)]
            for _, device_group in active_devices.groupby('device_id'):
                members = set(device_group['account_id'])
                if min_size <= len(members) <= max_size:
                    add_candidate(members, 'shared_device', window_start, window_end)

    return candidates


def _community_candidates(
    G: nx.DiGraph,
    communities: Sequence[Set[str]],
    transactions: pd.DataFrame,
    min_size: int,
    max_size: int,
) -> List[dict]:
    """Retain only small Louvain communities; large ones are not ring candidates."""
    candidates = []
    for community in communities:
        if min_size <= len(community) <= max_size:
            stats = _candidate_stats(transactions, community, 'community')
            # A community is only a ring candidate when it has at least as
            # many distinct directed links as members; this rejects ordinary
            # two-edge chains that happen to share a connected component.
            if stats is not None and stats['internal_edge_count'] >= len(community):
                candidates.append(stats)
    return candidates


def ring_candidates(
    G: nx.DiGraph,
    communities: Sequence[Set[str]],
    min_size: int = 3,
    max_size: int = 50,
    transactions: Optional[pd.DataFrame] = None,
    account_devices: Optional[pd.DataFrame] = None,
) -> pd.DataFrame:
    """Return small temporal and community ring candidates.

    `transactions` is optional for backwards compatibility. When supplied, the
    temporal detector is used because whole-graph Louvain communities often
    merge injected rings with unrelated high-volume accounts.
    """
    if transactions is None:
        rows = []
        for community in communities:
            if not (min_size <= len(community) <= max_size):
                continue
            subgraph = G.subgraph(community)
            internal = sum(data.get('weight', 0.0) for _, _, data in subgraph.edges(data=True))
            if internal <= 0:
                continue
            rows.append({
                'members': sorted(community),
                'size': len(community),
                'ring_score': float(internal),
                'total_flow_amount': float(internal),
                'internal_flow_ratio': 1.0,
                'pass_through': 0.0,
                'time_span_hours': 0.0,
                'internal_edge_count': subgraph.number_of_edges(),
                'external_in_amount': 0.0,
                'external_out_amount': 0.0,
                'candidate_source': 'community',
                'burst_score': 0.0,
                'flow_balance_score': 0.0,
            })
    else:
        rows = _temporal_candidates(
            transactions,
            min_size,
            max_size,
            account_devices=account_devices,
        )
        rows.extend(_community_candidates(G, communities, transactions, min_size, max_size))

    if not rows:
        return _empty_rings()

    # Deduplicate same member sets, keeping the strongest temporal candidate.
    best_by_members: Dict[frozenset, dict] = {}
    for row in rows:
        key = frozenset(row['members'])
        if key not in best_by_members or row['ring_score'] > best_by_members[key]['ring_score']:
            best_by_members[key] = row

    # Suppress nested hub neighborhoods: retain the stronger candidate when a
    # smaller set is contained in a larger set of the same directional source.
    ordered_rows = sorted(best_by_members.values(), key=lambda item: item['ring_score'], reverse=True)
    pruned = []
    for row in ordered_rows:
        members = set(row['members'])
        if any(
            members < set(existing['members'])
            and row['candidate_source'] == existing['candidate_source']
            and len(members) >= 3
            for existing in pruned
        ):
            continue
        pruned.append(row)

    # Source-specific quality gates keep the returned set actionable. Cycles
    # and shared-device groups are already structurally constrained; hub sets
    # need stronger cohesion because each window can contain many ordinary
    # high-degree accounts.
    filtered = []
    for row in pruned:
        source = row['candidate_source']
        min_score = {
            'cycle': 60.0,
            'shared_device': 70.0,
            'fan_in_hub': 60.0,
            'fan_out_hub': 60.0,
            'community': 0.0,
        }.get(source, 70.0)
        if row['ring_score'] >= min_score:
            filtered.append(row)

    rings = pd.DataFrame(filtered)
    if rings.empty:
        return _empty_rings()
    rings = rings.sort_values(['ring_score', 'size'], ascending=[False, True]).reset_index(drop=True)
    rings.insert(0, 'ring_id', [f'R_{i:03d}' for i in range(len(rings))])
    return rings[RING_COLUMNS]


def graph_features(
    G: nx.DiGraph,
    communities: Sequence[Set[str]],
    cycles: Sequence[Sequence[str]],
) -> pd.DataFrame:
    """Compute graph features for every graph node."""
    all_nodes = list(G.nodes())
    columns = [
        'in_degree', 'out_degree', 'pagerank', 'clustering_coef',
        'community_size', 'community_internal_flow_ratio',
        'community_density', 'in_short_cycle',
    ]
    if not all_nodes:
        return pd.DataFrame(columns=columns, index=pd.Index([], name='account_id'))

    in_degrees = dict(G.in_degree())
    out_degrees = dict(G.out_degree())
    try:
        pagerank = nx.pagerank(G, weight='weight', max_iter=100)
    except nx.PowerIterationFailedConvergence:
        pagerank = {node: 1.0 / len(all_nodes) for node in all_nodes}
    clustering = nx.clustering(G.to_undirected())

    node_to_community = {}
    community_sizes = {}
    community_ratio = {}
    community_density = {}
    for idx, community in enumerate(communities):
        community_sizes[idx] = len(community)
        for node in community:
            node_to_community[node] = idx
        subgraph = G.subgraph(community)
        internal = sum(data.get('weight', 0.0) for _, _, data in subgraph.edges(data=True))
        external = 0.0
        for node in community:
            external += sum(G[pred][node].get('weight', 0.0) for pred in G.predecessors(node) if pred not in community)
            external += sum(G[node][succ].get('weight', 0.0) for succ in G.successors(node) if succ not in community)
        community_ratio[idx] = internal / (internal + external) if internal + external else 0.0
        n = len(community)
        community_density[idx] = subgraph.number_of_edges() / (n * (n - 1)) if n > 1 else 0.0

    cycle_nodes = {node for cycle in cycles for node in cycle}
    rows = []
    for node in all_nodes:
        idx = node_to_community.get(node, -1)
        rows.append({
            'account_id': node,
            'in_degree': in_degrees.get(node, 0),
            'out_degree': out_degrees.get(node, 0),
            'pagerank': pagerank.get(node, 0.0),
            'clustering_coef': clustering.get(node, 0.0),
            'community_size': community_sizes.get(idx, 0),
            'community_internal_flow_ratio': community_ratio.get(idx, 0.0),
            'community_density': community_density.get(idx, 0.0),
            'in_short_cycle': int(node in cycle_nodes),
        })
    return pd.DataFrame(rows).set_index('account_id')


def _overlap(detected: Set[str], truth: Set[str]) -> Tuple[float, float]:
    intersection = len(detected & truth)
    return (
        intersection / len(detected) if detected else 0.0,
        intersection / len(truth) if truth else 0.0,
    )


def evaluate_rings(detected_rings: pd.DataFrame, labels: pd.DataFrame) -> Dict[str, object]:
    """Evaluate ring candidates with one-to-one matching at 70% overlap."""
    true_groups = labels[labels['is_mule'] == True].groupby('ring_id')
    true_rings = {ring_id: set(group['account_id']) for ring_id, group in true_groups}
    result = {
        'ring_precision': 0.0,
        'ring_recall': 0.0,
        'detected_count': int(len(detected_rings)),
        'true_positive_count': 0,
        'ground_truth_count': len(true_rings),
        'per_archetype': {},
    }
    if not true_rings or detected_rings is None or detected_rings.empty:
        result['candidate_sources'] = {}
        for archetype, group in labels[labels['is_mule'] == True].groupby('ring_archetype'):
            result['per_archetype'][archetype] = {
                'ground_truth': int(group['ring_id'].nunique()),
                'detected': 0,
                'recall': 0.0,
                'precision': 0.0,
                'f1': 0.0,
            }
        return result

    pairs = []
    for detected_index, row in detected_rings.iterrows():
        members = set(row['members'])
        for truth_id, truth_members in true_rings.items():
            precision_overlap, recall_overlap = _overlap(members, truth_members)
            if precision_overlap >= 0.7 and recall_overlap >= 0.7:
                pairs.append((precision_overlap + recall_overlap, detected_index, truth_id))
    pairs.sort(reverse=True)

    used_detected = set()
    used_truth = set()
    for _, detected_index, truth_id in pairs:
        if detected_index in used_detected or truth_id in used_truth:
            continue
        used_detected.add(detected_index)
        used_truth.add(truth_id)

    result['true_positive_count'] = len(used_detected)
    result['candidate_sources'] = (
        detected_rings['candidate_source'].value_counts().astype(int).to_dict()
        if detected_rings is not None and not detected_rings.empty else {}
    )
    result['ring_precision'] = len(used_detected) / len(detected_rings) if len(detected_rings) else 0.0
    result['ring_recall'] = len(used_truth) / len(true_rings) if true_rings else 0.0
    result['false_positive_count'] = int(len(detected_rings) - len(used_detected))
    result['precision_at_k'] = {}
    for k in (10, 25, 50):
        top = set(detected_rings.head(k).index)
        result['precision_at_k'][str(k)] = float(len(top & used_detected) / min(k, len(detected_rings))) if detected_rings is not None and len(detected_rings) else 0.0

    for archetype, group in labels[labels['is_mule'] == True].groupby('ring_archetype'):
        ids = set(group['ring_id'])
        detected = len(ids & used_truth)
        recall = detected / len(ids) if ids else 0.0
        result['per_archetype'][archetype] = {
            'ground_truth': len(ids),
            'detected': detected,
            'recall': recall,
            'precision': result['ring_precision'],
            'f1': (2 * result['ring_precision'] * recall / (result['ring_precision'] + recall))
                if result['ring_precision'] + recall else 0.0,
        }
    return result


if __name__ == '__main__':
    import os
    if os.path.exists('data/transactions.parquet'):
        tx = pd.read_parquet('data/transactions.parquet')
        labels = pd.read_parquet('data/labels.parquet')
        graph = build_graph(tx)
        communities = detect_communities(graph, seed=42)
        rings = ring_candidates(graph, communities, transactions=tx)
        print(f'Graph: {graph.number_of_nodes()} nodes, {graph.number_of_edges()} edges')
        print(f'Communities: {len(communities)} | candidates: {len(rings)}')
        print(evaluate_rings(rings, labels))
