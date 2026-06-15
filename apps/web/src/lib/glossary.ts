export interface GlossaryEntry {
  id: string;
  term: { ru: string; en: string };
  def: { ru: string; en: string };
  topicSlug?: string;
}

export const GLOSSARY: GlossaryEntry[] = [
  {
    id: 'acid',
    term: { ru: 'ACID', en: 'ACID' },
    def: {
      ru: 'Набор из четырёх свойств транзакций: атомарность, согласованность, изоляция и устойчивость. Они гарантируют, что данные останутся корректными даже при сбоях.',
      en: 'A set of four transaction guarantees: atomicity, consistency, isolation, and durability. Together they keep data correct even when failures happen.',
    },
    topicSlug: 'sql-fundamentals',
  },
  {
    id: 'transaction',
    term: { ru: 'Транзакция', en: 'Transaction' },
    def: {
      ru: 'Группа операций с базой, которая выполняется как единое целое: либо применяются все изменения, либо ни одно из них.',
      en: 'A group of database operations treated as one unit of work: either every change is applied, or none of them is.',
    },
    topicSlug: 'sql-fundamentals',
  },
  {
    id: 'index',
    term: { ru: 'Индекс', en: 'Index' },
    def: {
      ru: 'Вспомогательная структура данных, которая ускоряет поиск строк по значению столбца, избавляя от полного перебора таблицы.',
      en: 'An auxiliary data structure that speeds up finding rows by a column value, so the database avoids scanning the whole table.',
    },
    topicSlug: 'sql-fundamentals',
  },
  {
    id: 'primary-key',
    term: { ru: 'Первичный ключ', en: 'Primary key' },
    def: {
      ru: 'Столбец или набор столбцов, который уникально идентифицирует каждую строку таблицы. Не может быть пустым и не повторяется.',
      en: 'A column or set of columns that uniquely identifies each row in a table. It cannot be empty and never repeats.',
    },
    topicSlug: 'sql-fundamentals',
  },
  {
    id: 'foreign-key',
    term: { ru: 'Внешний ключ', en: 'Foreign key' },
    def: {
      ru: 'Столбец, который ссылается на первичный ключ другой таблицы и связывает строки между ними. Поддерживает целостность связей.',
      en: 'A column that references the primary key of another table and links rows between them. It keeps relationships consistent.',
    },
    topicSlug: 'sql-fundamentals',
  },
  {
    id: 'join',
    term: { ru: 'JOIN', en: 'Join' },
    def: {
      ru: 'Операция SQL, объединяющая строки из двух или более таблиц по совпадающим значениям, обычно по ключам.',
      en: 'A SQL operation that combines rows from two or more tables based on matching values, usually on keys.',
    },
    topicSlug: 'sql-fundamentals',
  },
  {
    id: 'normalization',
    term: { ru: 'Нормализация', en: 'Normalization' },
    def: {
      ru: 'Процесс разбиения данных на связанные таблицы, чтобы убрать дублирование и снизить риск противоречий при изменениях.',
      en: 'The process of splitting data into related tables to remove duplication and reduce the chance of inconsistent updates.',
    },
    topicSlug: 'sql-fundamentals',
  },
  {
    id: 'b-tree',
    term: { ru: 'B-дерево', en: 'B-tree' },
    def: {
      ru: 'Сбалансированное дерево поиска, которое держит данные отсортированными и обеспечивает быстрый поиск, вставку и удаление. На нём строится большинство индексов в базах.',
      en: 'A balanced search tree that keeps data sorted and gives fast lookup, insert, and delete. Most database indexes are built on it.',
    },
    topicSlug: 'python-storage-internals',
  },
  {
    id: 'mutability',
    term: { ru: 'Изменяемость', en: 'Mutability' },
    def: {
      ru: 'Свойство объекта, который можно менять после создания. В Python списки и словари изменяемы, а строки и кортежи - нет.',
      en: 'Whether an object can be changed after it is created. In Python lists and dicts are mutable, while strings and tuples are not.',
    },
    topicSlug: 'python-storage-internals',
  },
  {
    id: 'gil',
    term: { ru: 'GIL', en: 'GIL' },
    def: {
      ru: 'Глобальная блокировка интерпретатора в CPython, которая позволяет выполнять байт-код только одному потоку одновременно. Из-за неё потоки не ускоряют чисто вычислительный код.',
      en: 'The Global Interpreter Lock in CPython that lets only one thread run bytecode at a time. Because of it, threads do not speed up CPU-bound code.',
    },
  },
  {
    id: 'list-comprehension',
    term: { ru: 'List comprehension', en: 'List comprehension' },
    def: {
      ru: 'Краткий синтаксис Python для создания списка из другого итерируемого объекта в одну строку, с фильтрацией и преобразованием элементов.',
      en: 'A concise Python syntax for building a list from another iterable in one line, with optional filtering and transformation of items.',
    },
  },
  {
    id: 'decorator',
    term: { ru: 'Декоратор', en: 'Decorator' },
    def: {
      ru: 'Функция, которая принимает другую функцию и возвращает новую с расширенным поведением, не меняя её исходный код. Применяется через синтаксис @.',
      en: 'A function that takes another function and returns a new one with added behavior, without changing the original code. Applied with the @ syntax.',
    },
  },
  {
    id: 'generator',
    term: { ru: 'Генератор', en: 'Generator' },
    def: {
      ru: 'Функция, которая отдаёт значения по одному через yield и вычисляет их лениво, не держа весь результат в памяти.',
      en: 'A function that yields values one at a time and computes them lazily, without keeping the whole result in memory.',
    },
  },
  {
    id: 'mro',
    term: { ru: 'MRO', en: 'MRO' },
    def: {
      ru: 'Порядок разрешения методов - последовательность, в которой Python ищет атрибут или метод по цепочке родительских классов при множественном наследовании.',
      en: 'Method Resolution Order - the sequence in which Python looks up an attribute or method across parent classes when multiple inheritance is involved.',
    },
    topicSlug: 'python-mro',
  },
  {
    id: 'hash-table',
    term: { ru: 'Хеш-таблица', en: 'Hash table' },
    def: {
      ru: 'Структура данных, которая хранит пары ключ-значение и находит их за почти постоянное время с помощью хеш-функции. На ней основаны словари Python.',
      en: 'A data structure that stores key-value pairs and finds them in near-constant time using a hash function. Python dictionaries are built on it.',
    },
    topicSlug: 'python-storage-internals',
  },
  {
    id: 'big-o',
    term: { ru: 'O-большое', en: 'Big-O' },
    def: {
      ru: 'Запись, описывающая, как растёт время или память алгоритма при увеличении размера входных данных, без учёта констант.',
      en: 'A notation describing how an algorithm’s time or memory grows as the input size increases, ignoring constant factors.',
    },
    topicSlug: 'computational-complexity',
  },
];

export const getGlossaryEntry = (id: string): GlossaryEntry | undefined => {
  const normalized = id.trim().toLowerCase();
  return GLOSSARY.find((entry) => entry.id.toLowerCase() === normalized);
};
