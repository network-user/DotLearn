declare module 'virtual:search-index' {
  export interface SearchEntry {
    type: 'concept' | 'exercise';
    slug: string;
    conceptId: string;
    topicTitle: string;
    conceptTitle: string;
    language: 'en' | 'ru';
    text: string;
  }
  const searchIndex: string;
  export default searchIndex;
}
