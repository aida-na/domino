import Image from 'next/image';

type DominoBrandHeroProps = {
  className?: string;
  priority?: boolean;
};

/** Official domino chain brand mark — welcome screen & marketing. */
export function DominoBrandHero({ className = '', priority = false }: DominoBrandHeroProps) {
  return (
    <div
      className={`overflow-hidden rounded-[20px] shadow-[0_8px_32px_oklch(0.66_0.19_35_/_0.18)] ${className}`}
      style={{ aspectRatio: '1024 / 764' }}
    >
      <Image
        src="/brand/domino-hero.png"
        alt="domino tiles falling in a chain reaction"
        width={1024}
        height={764}
        priority={priority}
        className="h-full w-full object-cover"
        sizes="(max-width: 600px) 100vw, 560px"
      />
    </div>
  );
}
