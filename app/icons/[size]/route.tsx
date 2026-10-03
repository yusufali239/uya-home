import { ImageResponse } from 'next/og';

export const runtime = 'edge';

const SIZES = new Set([192, 512]);

/** Иконка PWA генерируется на лету: /icons/192, /icons/512 */
export function GET(_request: Request, { params }: { params: { size: string } }) {
  const size = SIZES.has(Number(params.size)) ? Number(params.size) : 192;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#8a623a',
          color: '#f6f3ee',
          fontWeight: 800,
        }}
      >
        <div style={{ fontSize: size * 0.34, lineHeight: 1 }}>UYA</div>
        <div style={{ fontSize: size * 0.12, letterSpacing: size * 0.02, marginTop: size * 0.04 }}>HOME</div>
      </div>
    ),
    {
      width: size,
      height: size,
      headers: { 'Cache-Control': 'public, max-age=86400, immutable' },
    },
  );
}
