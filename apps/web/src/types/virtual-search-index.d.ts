declare module 'virtual:search-index' {
  export interface SearchEntry {
    type: 'concept' | 'exercise';
    slug: string;
    conceptId: string;
    topicTitle: string;
    conceptTitle: string;
    text: string;
  }
}

declare module 'virtual:search-index/ru' {
  const searchIndex: string;
  export default searchIndex;
}

declare module 'virtual:search-index/en' {
  const searchIndex: string;
  export default searchIndex;
}
