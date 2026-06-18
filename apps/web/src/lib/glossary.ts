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
  {
    id: 'idempotency',
    term: { ru: 'Идемпотентность', en: 'Idempotency' },
    def: {
      ru: 'Свойство операции, при котором повторный её вызов с теми же входными данными даёт тот же результат и не меняет состояние сверх первого выполнения.',
      en: 'A property where repeating an operation with the same input yields the same result and does not change state beyond the first execution.',
    },
  },
  {
    id: 'latency',
    term: { ru: 'Латентность', en: 'Latency' },
    def: {
      ru: 'Задержка между отправкой запроса и получением ответа. Измеряет, как быстро система реагирует на отдельную операцию.',
      en: 'The delay between sending a request and receiving a response. It measures how quickly a system reacts to a single operation.',
    },
  },
  {
    id: 'throughput',
    term: { ru: 'Пропускная способность', en: 'Throughput' },
    def: {
      ru: 'Количество операций, которое система успевает обработать за единицу времени. В отличие от латентности описывает объём, а не скорость отклика.',
      en: 'The number of operations a system can process per unit of time. Unlike latency, it describes volume rather than response speed.',
    },
  },
  {
    id: 'embedding',
    term: { ru: 'Эмбеддинг', en: 'Embedding' },
    def: {
      ru: 'Представление слова, фразы или объекта в виде вектора чисел, где близость векторов отражает смысловую близость.',
      en: 'A representation of a word, phrase, or object as a vector of numbers, where vector closeness reflects semantic similarity.',
    },
    topicSlug: 'llm-foundations',
  },
  {
    id: 'token',
    term: { ru: 'Токенизация', en: 'Tokenization' },
    def: {
      ru: 'Разбиение текста на токены - минимальные единицы, которыми оперирует языковая модель. Токен может быть словом, частью слова или символом.',
      en: 'Splitting text into tokens - the smallest units a language model operates on. A token can be a word, a word piece, or a character.',
    },
    topicSlug: 'llm-foundations',
  },
  {
    id: 'gradient-descent',
    term: { ru: 'Градиентный спуск', en: 'Gradient descent' },
    def: {
      ru: 'Алгоритм оптимизации, который шаг за шагом меняет параметры модели в сторону уменьшения ошибки, двигаясь против градиента функции потерь.',
      en: 'An optimization algorithm that adjusts model parameters step by step to reduce error, moving against the gradient of the loss function.',
    },
    topicSlug: 'neural-networks',
  },
  {
    id: 'overfitting',
    term: { ru: 'Переобучение', en: 'Overfitting' },
    def: {
      ru: 'Ситуация, когда модель слишком точно подстраивается под обучающие данные и теряет способность обобщать на новые примеры.',
      en: 'When a model fits the training data too closely and loses the ability to generalize to new examples.',
    },
    topicSlug: 'neural-networks',
  },
  {
    id: 'attention',
    term: { ru: 'Механизм внимания', en: 'Attention mechanism' },
    def: {
      ru: 'Механизм в трансформерах, который позволяет модели для каждого токена взвешивать, насколько важны остальные токены контекста.',
      en: 'A mechanism in transformers that lets the model weigh, for each token, how relevant the other tokens in the context are.',
    },
    topicSlug: 'llm-foundations',
  },
  {
    id: 'hallucination',
    term: { ru: 'Галлюцинация', en: 'Hallucination' },
    def: {
      ru: 'Уверенно сформулированный, но фактически неверный ответ языковой модели. Модель выдаёт правдоподобный текст без опоры на реальные данные.',
      en: 'A confidently phrased but factually wrong answer from a language model. It produces plausible text without grounding in real data.',
    },
    topicSlug: 'llm-foundations',
  },
];

export const getGlossaryEntry = (id: string): GlossaryEntry | undefined => {
  const normalized = id.trim().toLowerCase();
  return GLOSSARY.find((entry) => entry.id.toLowerCase() === normalized);
};
