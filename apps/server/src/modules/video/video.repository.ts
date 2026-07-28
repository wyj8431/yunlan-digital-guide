import Database from 'better-sqlite3';
import { SENSITIVE_KEYWORD_SEEDS, SUBTITLE_CUE_SEEDS, VIDEO_SEEDS } from './video.seed.js';
import type {
  Danmaku,
  DanmakuColor,
  DanmakuPosition,
  SubtitleCue,
  VideoSummary
} from './video.types.js';

type VideoRow = {
  id: string;
  title: string;
  description: string;
  cover_url: string;
  video_url: string;
  duration_ms: number;
};

type SubtitleCueRow = {
  id: number;
  video_id: string;
  start_ms: number;
  end_ms: number;
  content: string;
};

type DanmakuRow = {
  id: number;
  video_id: string;
  content: string;
  timestamp_ms: number;
  position: DanmakuPosition;
  color: DanmakuColor;
  nickname: string;
  created_at: string;
};

export type StoredDanmakuInput = {
  videoId: string;
  content: string;
  timestampMs: number;
  position: DanmakuPosition;
  color: DanmakuColor;
};

function mapVideo(row: VideoRow): VideoSummary {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    coverUrl: row.cover_url,
    videoUrl: row.video_url,
    durationMs: row.duration_ms
  };
}

function mapSubtitleCue(row: SubtitleCueRow): SubtitleCue {
  return {
    id: row.id,
    videoId: row.video_id,
    startMs: row.start_ms,
    endMs: row.end_ms,
    content: row.content
  };
}

function mapDanmaku(row: DanmakuRow): Danmaku {
  return {
    id: row.id,
    videoId: row.video_id,
    content: row.content,
    timestampMs: row.timestamp_ms,
    position: row.position,
    color: row.color,
    nickname: row.nickname,
    createdAt: row.created_at
  };
}

export class VideoRepository {
  private readonly database: Database.Database;

  constructor(databasePath: string) {
    this.database = new Database(databasePath);

    try {
      this.database.pragma('foreign_keys = ON');
      this.initializeSchema();
      this.seedDatabase();
    } catch (caught) {
      this.close();
      throw caught;
    }
  }

  listVideos(): VideoSummary[] {
    const rows = this.database
      .prepare(
        `SELECT id, title, description, cover_url, video_url, duration_ms
         FROM videos
         ORDER BY sort_order ASC`
      )
      .all() as VideoRow[];

    return rows.map(mapVideo);
  }

  findVideoById(videoId: string): VideoSummary | null {
    const row = this.database
      .prepare(
        `SELECT id, title, description, cover_url, video_url, duration_ms
         FROM videos
         WHERE id = ?`
      )
      .get(videoId) as VideoRow | undefined;

    return row ? mapVideo(row) : null;
  }

  listSubtitleCues(videoId: string): SubtitleCue[] {
    const rows = this.database
      .prepare(
        `SELECT id, video_id, start_ms, end_ms, content
         FROM subtitle_cues
         WHERE video_id = ?
         ORDER BY start_ms ASC, id ASC`
      )
      .all(videoId) as SubtitleCueRow[];

    return rows.map(mapSubtitleCue);
  }

  listSensitiveKeywords(): string[] {
    const rows = this.database
      .prepare('SELECT keyword FROM sensitive_keywords ORDER BY length(keyword) DESC, keyword ASC')
      .all() as Array<{ keyword: string }>;

    return rows.map((row) => row.keyword);
  }

  createDanmaku(input: StoredDanmakuInput): Danmaku {
    return this.database.transaction(() => {
      const createdAt = new Date().toISOString();
      const result = this.database
        .prepare(
          `INSERT INTO danmaku (
             video_id, content, timestamp_ms, position, color, nickname, created_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          input.videoId,
          input.content,
          input.timestampMs,
          input.position,
          input.color,
          '',
          createdAt
        );
      const id = Number(result.lastInsertRowid);
      const nickname = `游客 ${String(id % 10_000).padStart(4, '0')}`;

      this.database.prepare('UPDATE danmaku SET nickname = ? WHERE id = ?').run(nickname, id);

      const row = this.database
        .prepare(
          `SELECT id, video_id, content, timestamp_ms, position, color, nickname, created_at
           FROM danmaku
           WHERE id = ?`
        )
        .get(id) as DanmakuRow;

      return mapDanmaku(row);
    })();
  }

  listDanmaku(videoId: string, fromMs: number, toMs: number): Danmaku[] {
    const rows = this.database
      .prepare(
        `SELECT id, video_id, content, timestamp_ms, position, color, nickname, created_at
         FROM danmaku
         WHERE video_id = ? AND timestamp_ms >= ? AND timestamp_ms <= ?
         ORDER BY timestamp_ms ASC, id ASC`
      )
      .all(videoId, fromMs, toMs) as DanmakuRow[];

    return rows.map(mapDanmaku);
  }

  close(): void {
    if (this.database.open) {
      this.database.close();
    }
  }

  private initializeSchema(): void {
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS videos (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        cover_url TEXT NOT NULL,
        video_url TEXT NOT NULL,
        duration_ms INTEGER NOT NULL CHECK (duration_ms > 0),
        sort_order INTEGER NOT NULL UNIQUE
      );

      CREATE TABLE IF NOT EXISTS danmaku (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        video_id TEXT NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
        content TEXT NOT NULL CHECK (length(content) > 0),
        timestamp_ms INTEGER NOT NULL CHECK (timestamp_ms >= 0),
        position TEXT NOT NULL CHECK (position IN ('scroll', 'top', 'bottom')),
        color TEXT NOT NULL CHECK (color IN ('#ffffff', '#f5d76e', '#aee7ff', '#ffc0cb')),
        nickname TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sensitive_keywords (
        keyword TEXT PRIMARY KEY CHECK (length(keyword) > 0)
      );

      CREATE TABLE IF NOT EXISTS subtitle_cues (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        video_id TEXT NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
        start_ms INTEGER NOT NULL CHECK (start_ms >= 0),
        end_ms INTEGER NOT NULL CHECK (end_ms > start_ms),
        content TEXT NOT NULL CHECK (length(content) > 0)
      );

      CREATE INDEX IF NOT EXISTS danmaku_video_time_idx
        ON danmaku(video_id, timestamp_ms, id);
      CREATE INDEX IF NOT EXISTS subtitle_cues_video_time_idx
        ON subtitle_cues(video_id, start_ms, id);
      CREATE UNIQUE INDEX IF NOT EXISTS subtitle_cues_natural_key_idx
        ON subtitle_cues(video_id, start_ms, end_ms, content);
    `);
  }

  private seedDatabase(): void {
    this.database.transaction(() => {
      const insertVideo = this.database.prepare(
        `INSERT INTO videos (
           id, title, description, cover_url, video_url, duration_ms, sort_order
         ) VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           title = excluded.title,
           description = excluded.description,
           cover_url = excluded.cover_url,
           video_url = excluded.video_url,
           duration_ms = excluded.duration_ms,
           sort_order = excluded.sort_order`
      );
      VIDEO_SEEDS.forEach((video, index) => {
        insertVideo.run(
          video.id,
          video.title,
          video.description,
          video.coverUrl,
          video.videoUrl,
          video.durationMs,
          index
        );
      });

      const insertSubtitleCue = this.database.prepare(
        `INSERT INTO subtitle_cues (video_id, start_ms, end_ms, content)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(video_id, start_ms, end_ms, content) DO NOTHING`
      );
      for (const cue of SUBTITLE_CUE_SEEDS) {
        insertSubtitleCue.run(cue.videoId, cue.startMs, cue.endMs, cue.content);
      }

      const insertKeyword = this.database.prepare(
        `INSERT INTO sensitive_keywords (keyword) VALUES (?)
         ON CONFLICT(keyword) DO NOTHING`
      );
      for (const keyword of SENSITIVE_KEYWORD_SEEDS) {
        insertKeyword.run(keyword);
      }
    })();
  }
}
