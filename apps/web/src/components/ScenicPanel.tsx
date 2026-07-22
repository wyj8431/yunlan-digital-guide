import { Clock, Image as ImageIcon, MapPin } from 'lucide-react';
import { useState } from 'react';
import type { RouteCard, ScenicAreaSummary } from '../types/guide';

type ScenicPanelProps = {
  scenicArea: ScenicAreaSummary;
  routeCards: RouteCard[];
};

const TOUR_VIDEO_SRC = 'https://www.w3schools.com/html/mov_bbb.mp4';

const gallery = [
  {
    src: 'https://images.unsplash.com/photo-1508804185872-d7badad00f7d?auto=format&fit=crop&w=960&q=80',
    alt: '古镇水巷'
  },
  {
    src: 'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=960&q=80',
    alt: '青石古桥'
  },
  {
    src: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=960&q=80',
    alt: '河畔夜灯'
  }
];

function buildDefaultRouteCards(scenicArea: ScenicAreaSummary): RouteCard[] {
  return scenicArea.routes.map((route) => ({
    type: 'route-step',
    title: route.name,
    duration: route.duration,
    description: route.description
  }));
}

export function ScenicPanel({ scenicArea, routeCards }: ScenicPanelProps) {
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const currentImage = gallery[selectedImageIndex];
  const visibleRouteCards = routeCards.length > 0 ? routeCards : buildDefaultRouteCards(scenicArea);

  return (
    <aside className="scenic-panel" aria-label="景区信息">
      <section className="scenic-summary">
        <div className="scenic-location">
          <MapPin size={14} aria-hidden="true" />
          <span>Yunlan, China</span>
        </div>
        <h1>{scenicArea.scenicArea.name}</h1>
        <h2>Yunlan Ancient Town</h2>
        <p>{scenicArea.scenicArea.description}</p>

        <div className="scenic-meta">
          <div>
            <span>Open</span>
            <strong>{scenicArea.scenicArea.openingHours}</strong>
          </div>
          <div>
            <span>Ticket</span>
            <strong>{scenicArea.scenicArea.ticketInfo}</strong>
          </div>
        </div>
      </section>

      <section className="scenic-section">
        <div className="section-title-row">
          <h3>全景漫游</h3>
          <span>360 Video</span>
        </div>
        <div className="video-card">
          <video
            className="tour-video"
            controls
            playsInline
            preload="metadata"
            poster={gallery[0].src}
            aria-label="全景漫游视频"
          >
            <source src={TOUR_VIDEO_SRC} type="video/mp4" />
            当前浏览器不支持视频播放。
          </video>
        </div>
      </section>

      <section className="scenic-section">
        <div className="section-title-row">
          <h3>实景图集</h3>
          <span>Gallery</span>
        </div>
        <div className="featured-photo">
          <img src={currentImage.src} alt={currentImage.alt} />
          <span>
            <ImageIcon size={14} aria-hidden="true" />
            {currentImage.alt}
          </span>
        </div>
        <div className="gallery-grid">
          {gallery.map((image, index) => (
            <button
              key={image.src}
              type="button"
              className={index === selectedImageIndex ? 'is-selected' : ''}
              onClick={() => setSelectedImageIndex(index)}
              aria-label={`查看${image.alt}`}
            >
              <img src={image.src} alt="" />
            </button>
          ))}
        </div>
      </section>

      <section className="scenic-section">
        <div className="section-title-row">
          <h3>智能路线</h3>
          <span>{routeCards.length > 0 ? 'AI Route' : 'Default'}</span>
        </div>
        <div className="route-cards compact-route-cards" aria-label="推荐路线">
          {visibleRouteCards.slice(0, 4).map((card, index) => (
            <article key={`${card.title}-${index}`} className="route-card">
              <span>{index + 1}</span>
              <div>
                <h3>{card.title}</h3>
                <p className="route-duration">
                  <Clock size={13} aria-hidden="true" />
                  {card.duration}
                </p>
                <p>{card.description}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="scenic-section scenic-services">
        <div className="section-title-row">
          <h3>服务点</h3>
          <span>Service</span>
        </div>
        <div className="service-list">
          {scenicArea.services.slice(0, 4).map((service) => (
            <article key={service.id}>
              <strong>{service.name}</strong>
              <span>{service.description}</span>
            </article>
          ))}
        </div>
      </section>
    </aside>
  );
}
