/** Six static sample report types (Product Spec §5.9, Data & Mocks §12). */
export type ReportType = 'airline-transactions' | 'booking-transactions' | 'refund-transactions' | 'exchange-transactions' | 'ancillary-services' | 'other-transactions';
export const REPORTS: { type: ReportType; title: string; category: 'Booking-based' | 'Amendments-based'; prefix: string; columns: string[] }[] = [
  { type: 'airline-transactions', title: 'Airline Transactions', category: 'Booking-based', prefix: 'AIR', columns: ['Airline', 'GDS', 'Supplier', 'Route', 'FareBrand', 'SupplierChargeINR', 'AgencyChargeINR', 'TicketStatus'] },
  { type: 'booking-transactions', title: 'Booking Transactions', category: 'Booking-based', prefix: 'BKG', columns: ['PassengerReference', 'PNR', 'TicketNumber', 'TripType', 'Cabin', 'BaseFareINR', 'TaxesINR', 'AgencyTotalINR'] },
  { type: 'refund-transactions', title: 'Refund Transactions', category: 'Amendments-based', prefix: 'REF', columns: ['ClaimReference', 'CancellationDate', 'ExpectedRefundINR', 'OtaPaidINR', 'SupplierExpectedINR', 'SupplierReceivedINR', 'PayoutStatus', 'SupplierStatus'] },
  { type: 'exchange-transactions', title: 'Exchange Transactions', category: 'Amendments-based', prefix: 'EXC', columns: ['OriginalBooking', 'ReissueReference', 'OldItinerary', 'NewItinerary', 'AirlineChangeFeeINR', 'FareDifferenceINR', 'RequestStatus'] },
  { type: 'ancillary-services', title: 'Ancillary Services', category: 'Amendments-based', prefix: 'ANC', columns: ['AncillaryType', 'Supplier', 'Quantity', 'CostINR', 'AgencySellingPriceINR', 'FulfillmentStatus'] },
  { type: 'other-transactions', title: 'Others', category: 'Amendments-based', prefix: 'OTH', columns: ['CaseReference', 'AdjustmentType', 'AmountINR', 'ApprovalStatus', 'ReconciliationStatus'] },
];
export const COMMON_COLUMNS = ['SampleRecordId', 'TransactionDate', 'AgencyId', 'AgencyName', 'BookingReference', 'ReportScope', 'Currency', 'Status', 'SampleData'];
export const REPORT_SNAPSHOT_AT = '2026-11-18T18:30:00.000Z';
export const AGENCY_NAMES: Record<string, string> = { agency_skyline: 'Skyline Travels', agency_orbit: 'Orbit Corporate Travel', agency_aster: 'Aster Holidays' };
export type ReportRow = Record<string, string | number>;
