export interface RecentPO {
    id: string;
    po_number: string;
    project_name: string;
    client_name: string;
    amount: number;
    created_at: string;
}
export declare function fetchRecentPOs(): Promise<RecentPO[]>;
