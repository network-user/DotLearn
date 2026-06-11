export interface SqlTemplate {
  id: string;
  labelKey: string;
  descriptionKey: string;
  schema: string;
  query: string;
}

const BLANK_SCHEMA = `CREATE TABLE notes (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL
);

INSERT INTO notes (id, title, body) VALUES
  (1, 'Первая заметка', 'Здесь можно писать любой SQL.'),
  (2, 'Идея', 'Создай свои таблицы и наполни их данными.');`;

const BLANK_QUERY = `SELECT id, title, body
FROM notes
ORDER BY id;`;

const SHOP_SCHEMA = `CREATE TABLE customers (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  city TEXT NOT NULL
);

CREATE TABLE products (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  price INTEGER NOT NULL
);

CREATE TABLE orders (
  id INTEGER PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  created_at TEXT NOT NULL
);

CREATE TABLE order_items (
  id INTEGER PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id),
  product_id INTEGER NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL
);

INSERT INTO customers (id, name, city) VALUES
  (1, 'Анна Иванова', 'Москва'),
  (2, 'Пётр Смирнов', 'Санкт-Петербург'),
  (3, 'Мария Кузнецова', 'Казань'),
  (4, 'Дмитрий Соколов', 'Новосибирск'),
  (5, 'Елена Попова', 'Екатеринбург'),
  (6, 'Сергей Морозов', 'Москва');

INSERT INTO products (id, name, price) VALUES
  (1, 'Беспроводные наушники', 5990),
  (2, 'Кофемолка', 3490),
  (3, 'Механическая клавиатура', 7200),
  (4, 'Настольная лампа', 1850),
  (5, 'Термокружка', 990),
  (6, 'Рюкзак городской', 4300);

INSERT INTO orders (id, customer_id, created_at) VALUES
  (1, 1, '2024-03-01'),
  (2, 2, '2024-03-02'),
  (3, 1, '2024-03-05'),
  (4, 3, '2024-03-07'),
  (5, 5, '2024-03-09'),
  (6, 6, '2024-03-11'),
  (7, 2, '2024-03-12');

INSERT INTO order_items (id, order_id, product_id, quantity) VALUES
  (1, 1, 1, 1),
  (2, 1, 5, 2),
  (3, 2, 3, 1),
  (4, 3, 2, 1),
  (5, 3, 4, 2),
  (6, 4, 6, 1),
  (7, 5, 1, 1),
  (8, 5, 5, 3),
  (9, 6, 3, 1),
  (10, 7, 2, 2);`;

const SHOP_QUERY = `SELECT c.name AS клиент,
       c.city AS город,
       SUM(p.price * oi.quantity) AS сумма
FROM customers c
JOIN orders o ON o.customer_id = c.id
JOIN order_items oi ON oi.order_id = o.id
JOIN products p ON p.id = oi.product_id
GROUP BY c.id
ORDER BY сумма DESC;`;

const BLOG_SCHEMA = `CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  joined_at TEXT NOT NULL
);

CREATE TABLE posts (
  id INTEGER PRIMARY KEY,
  author_id INTEGER NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  published_at TEXT NOT NULL
);

CREATE TABLE comments (
  id INTEGER PRIMARY KEY,
  post_id INTEGER NOT NULL REFERENCES posts(id),
  author_id INTEGER NOT NULL REFERENCES users(id),
  body TEXT NOT NULL
);

INSERT INTO users (id, name, joined_at) VALUES
  (1, 'Ольга Васильева', '2023-11-04'),
  (2, 'Игорь Лебедев', '2023-12-18'),
  (3, 'Наталья Орлова', '2024-01-22'),
  (4, 'Алексей Фёдоров', '2024-02-09');

INSERT INTO posts (id, author_id, title, body, published_at) VALUES
  (1, 1, 'Как я начала вести блог', 'Короткая история о первых заметках и привычке писать каждый день.', '2024-02-01'),
  (2, 2, 'Пять книг этой зимы', 'Подборка нон-фикшн книг, которые стоит прочитать в холодные вечера.', '2024-02-05'),
  (3, 1, 'Заметки о продуктивности', 'Почему списки дел работают не у всех и что попробовать вместо них.', '2024-02-12'),
  (4, 3, 'Прогулки по старому городу', 'Маршрут выходного дня с тихими дворами и кофейнями.', '2024-02-20');

INSERT INTO comments (id, post_id, author_id, body) VALUES
  (1, 1, 2, 'Очень вдохновляющий текст, спасибо!'),
  (2, 1, 3, 'Тоже давно хочу начать, теперь решусь.'),
  (3, 2, 4, 'Добавил половину списка в закладки.'),
  (4, 3, 2, 'А мне списки наоборот помогают.'),
  (5, 3, 4, 'Попробую метод из последнего абзаца.'),
  (6, 4, 1, 'Знаю этот маршрут, лучшие дворы в городе.');`;

const BLOG_QUERY = `SELECT p.title AS статья,
       u.name AS автор,
       COUNT(c.id) AS комментариев
FROM posts p
JOIN users u ON u.id = p.author_id
LEFT JOIN comments c ON c.post_id = p.id
GROUP BY p.id
ORDER BY комментариев DESC;`;

const LIBRARY_SCHEMA = `CREATE TABLE members (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  city TEXT NOT NULL
);

CREATE TABLE books (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  year INTEGER NOT NULL
);

CREATE TABLE loans (
  id INTEGER PRIMARY KEY,
  member_id INTEGER NOT NULL REFERENCES members(id),
  book_id INTEGER NOT NULL REFERENCES books(id),
  borrowed_at TEXT NOT NULL,
  returned_at TEXT
);

INSERT INTO members (id, name, city) VALUES
  (1, 'Виктор Зайцев', 'Москва'),
  (2, 'Татьяна Никитина', 'Самара'),
  (3, 'Роман Беляев', 'Пермь'),
  (4, 'Людмила Гусева', 'Уфа');

INSERT INTO books (id, title, author, year) VALUES
  (1, 'Война и мир', 'Лев Толстой', 1869),
  (2, 'Преступление и наказание', 'Фёдор Достоевский', 1866),
  (3, 'Мастер и Маргарита', 'Михаил Булгаков', 1967),
  (4, 'Отцы и дети', 'Иван Тургенев', 1862),
  (5, 'Вишнёвый сад', 'Антон Чехов', 1904);

INSERT INTO loans (id, member_id, book_id, borrowed_at, returned_at) VALUES
  (1, 1, 3, '2024-01-10', '2024-01-24'),
  (2, 2, 1, '2024-01-15', NULL),
  (3, 3, 2, '2024-02-01', '2024-02-14'),
  (4, 1, 5, '2024-02-05', NULL),
  (5, 4, 3, '2024-02-08', '2024-02-20'),
  (6, 2, 4, '2024-02-12', NULL);`;

const LIBRARY_QUERY = `SELECT m.name AS читатель,
       b.title AS книга,
       b.author AS автор,
       l.borrowed_at AS выдана
FROM loans l
JOIN members m ON m.id = l.member_id
JOIN books b ON b.id = l.book_id
WHERE l.returned_at IS NULL
ORDER BY l.borrowed_at;`;

export const sqlTemplates: SqlTemplate[] = [
  {
    id: 'shop',
    labelKey: 'sql.templates.shop.label',
    descriptionKey: 'sql.templates.shop.description',
    schema: SHOP_SCHEMA,
    query: SHOP_QUERY,
  },
  {
    id: 'blog',
    labelKey: 'sql.templates.blog.label',
    descriptionKey: 'sql.templates.blog.description',
    schema: BLOG_SCHEMA,
    query: BLOG_QUERY,
  },
  {
    id: 'library',
    labelKey: 'sql.templates.library.label',
    descriptionKey: 'sql.templates.library.description',
    schema: LIBRARY_SCHEMA,
    query: LIBRARY_QUERY,
  },
  {
    id: 'blank',
    labelKey: 'sql.templates.blank.label',
    descriptionKey: 'sql.templates.blank.description',
    schema: BLANK_SCHEMA,
    query: BLANK_QUERY,
  },
];

export const sqlTemplateById = (id: string): SqlTemplate | undefined =>
  sqlTemplates.find((template) => template.id === id);

export const defaultSqlTemplate: SqlTemplate = sqlTemplates[0] as SqlTemplate;
