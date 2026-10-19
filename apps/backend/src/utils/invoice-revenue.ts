export function calculateCollectedInvoiceRevenue(
    paidInvoiceTotal: number | null,
    partialPaidAmount: number | null,
    partialDepositAmount: number | null,
) {
    return (paidInvoiceTotal || 0) + (partialPaidAmount || 0) + (partialDepositAmount || 0);
}
