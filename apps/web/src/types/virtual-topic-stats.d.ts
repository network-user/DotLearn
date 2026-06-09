declare module 'virtual:topic-stats' {
  const topicStats: Record<string, Record<'en' | 'ru', number | undefined> | undefined>;
  export default topicStats;
}
