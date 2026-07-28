import { Landmark, PlaySquare } from 'lucide-react';

export function HomeDestinationLinks() {
  return (
    <nav className="home-destination-links" aria-label="扩展体验入口">
      <a className="home-destination-link home-destination-link--exhibition" href="/exhibition">
        <Landmark data-testid="destination-icon" aria-hidden="true" size={18} />
        <span>3D 展馆</span>
      </a>
      <a className="home-destination-link home-destination-link--videos" href="/videos">
        <PlaySquare data-testid="destination-icon" aria-hidden="true" size={18} />
        <span>视频中心</span>
      </a>
    </nav>
  );
}
