import { getBishConnectToken } from './auth'
import { isBishConnectConfigured } from './config'
import { BishConnectNotConfiguredError, MediaServiceError } from './errors'
import type { MediaAssociation } from '@/lib/trade-media'

interface MediaLink {
  cloudfront_url: string | null
}

interface MediaMetaData {
  user: { user_email: string; user_id: string }
  media: {
    media_id: string
    media_type: string
    links: Record<string, MediaLink | MediaLink[] | null> | null
  }
  status: string
  created_date: string
}

export interface MediaItem {
  media_id: string
  media_type: string
  status: string
  links: Record<string, string>
  uploaded_by: string
  created_date: string
}

// Flatten renditions to their URLs; list-valued renditions are user-requested extras and skipped
const linkUrls = (links: MediaMetaData['media']['links']) => {
  const urls: Record<string, string> = {}
  for (const [rendition, link] of Object.entries(links ?? {})) {
    if (link && !Array.isArray(link) && link.cloudfront_url) {
      urls[rendition] = link.cloudfront_url
    }
  }
  return urls
}

/**
 * List media associated to one (media_domain, source_id) pair from the BishConnect media service
 */
export async function getMedia({ media_domain, source_id }: MediaAssociation): Promise<MediaItem[]> {
  if (!isBishConnectConfigured()) {
    throw new BishConnectNotConfiguredError()
  }

  const token = await getBishConnectToken()

  const url = new URL(`${process.env.BISHCONNECT_API_URL}/media-service/media`)
  url.searchParams.set('media_domain', media_domain)
  url.searchParams.set('source_id', source_id)

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    throw new MediaServiceError(response.status, await response.text())
  }

  const data = (await response.json()) as { meta_data: MediaMetaData[] }

  return data.meta_data.map((item) => ({
    media_id: item.media.media_id,
    media_type: item.media.media_type,
    status: item.status,
    links: linkUrls(item.media.links),
    uploaded_by: item.user.user_email,
    created_date: item.created_date,
  }))
}
