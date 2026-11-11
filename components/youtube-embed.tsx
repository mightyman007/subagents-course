interface YouTubeEmbedProps {
  /** YouTube video id (the value of the `v=` query param in a watch URL). */
  id: string;
  /** Human-readable title — doubles as the iframe's accessible name. */
  title: string;
}

/**
 * Privacy-enhanced YouTube embed: the video loads from youtube-nocookie.com,
 * so viewing a lesson page doesn't set YouTube tracking cookies up front.
 * The wrapper is a fixed 16:9 (aspect-video) box; the iframe fills it so the
 * embed scales with the page column.
 */
export function YouTubeEmbed({ id, title }: YouTubeEmbedProps) {
  return (
    <div className="relative my-6 aspect-video overflow-hidden rounded-lg border border-line">
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${id}`}
        title={title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        loading="lazy"
        referrerPolicy="strict-origin-when-cross-origin"
        className="absolute inset-0 h-full w-full"
      />
    </div>
  );
}
