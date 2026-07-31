// 为缺少完整 TypeScript 声明的文档解析依赖提供最小安全接口。
declare module 'word-extractor' {
  type ExtractedWordDocument = {
    getBody(): string;
    getFootnotes(): string;
    getEndnotes(): string;
    getHeaders(): string;
    getFooters(): string;
    getAnnotations(): string;
    getTextboxes(): string;
  };

  export default class WordExtractor {
    extract(source: string | Buffer): Promise<ExtractedWordDocument>;
  }
}

declare module 'ppt-to-text' {
  type ExtractTextOptions = {
    separator?: string;
    encoding?: string;
  };

  const ppt: {
    extractText(input: string | Buffer, options?: ExtractTextOptions): string;
  };

  export default ppt;
}
