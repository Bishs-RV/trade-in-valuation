'use client';

import TradeForm from '@/components/forms/TradeForm';
import PhotosCard from '@/components/PhotosCard';

export default function Home() {
  return (
    <div className="p-4 pb-24 flex flex-col gap-2">
      <TradeForm />
      <PhotosCard />
    </div>
  );
}
