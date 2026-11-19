'use client';
import { use } from 'react';
import { BookingDetail } from '@/components/booking/BookingDetail';
export default function Page({ params }: { params: Promise<{ id: string }> }) { const { id } = use(params); return <BookingDetail id={id} back="/agency/bookings" />; }
