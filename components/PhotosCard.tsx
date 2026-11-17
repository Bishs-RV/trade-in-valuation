'use client';

import { useSession } from 'next-auth/react';
import { useMockAuth } from '@bishs-rv/bishs-global-header';
import { MediaService } from '@bishs-rv/media-service';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useEvaluationId, useTradeStore } from '@/lib/store';
import { TRADE_EVALUATION, tradeMediaAssociations, tradeMediaSource } from '@/lib/trade-media';

export default function PhotosCard() {
  const { data: session, status } = useSession();
  const mockAuth = useMockAuth();
  const evaluationId = useEvaluationId();
  const vin = useTradeStore((state) => state.data.vin) || null;

  // Photos need a saved evaluation to attach to
  if (!evaluationId) return null;

  const isRealAuthActive = status === 'authenticated' && session?.user;
  const userEmail = isRealAuthActive
    ? (session.user.email ?? 'unknown@bishs.com')
    : (mockAuth.user?.email ?? 'test@bishs.com');
  const userId = isRealAuthActive ? (session.user.id ?? userEmail) : userEmail;

  const keys = { tradeEvaluationId: evaluationId, vin };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Photos</CardTitle>
        <CardDescription>
          {vin
            ? `Shared across every evaluation of VIN ${vin}`
            : 'Attached to this evaluation only (no VIN entered)'}
        </CardDescription>
      </CardHeader>
      <CardContent className="px-2 sm:px-6">
        <MediaService
          context={{ user_email: userEmail, user_id: userId, ...tradeMediaSource(keys) }}
          associate={tradeMediaAssociations(keys)}
          dissociate={[]}
          viewing={[{ media_domain: TRADE_EVALUATION, source_id: String(evaluationId) }]}
        />
      </CardContent>
    </Card>
  );
}
