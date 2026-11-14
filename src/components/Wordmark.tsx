import { PRODUCT_CLAIM, PRODUCT_NAME } from '@/lib/brand'

/** The domain as name, the claim after an en dash (hidden when the line is short). */
export function Wordmark({ claim = 'inline' }: { claim?: 'inline' | 'none' }) {
  return (
    <>
      {PRODUCT_NAME}
      {claim === 'inline' && (
        <span className="hidden font-normal text-zinc-600 md:inline"> – {PRODUCT_CLAIM}</span>
      )}
    </>
  )
}
