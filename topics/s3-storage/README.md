# S3: объектное хранилище, boto3, доступ и стоимость

Тема для backend-разработчиков, которые кладут файлы пользователей, бэкапы и медиа в облако и хотят понимать, что происходит под капотом S3, а не копировать сниппеты наугад. S3 - это не сетевой диск: это плоское пространство строковых ключей с собственной моделью доступа и стоимости. Разбираем объектную модель (bucket, object, key, отсутствие настоящих папок), работу через boto3 с обязательной пагинацией списков и multipart-загрузкой, presigned URL для прямого доступа в обход бэкенда, модель безопасности (IAM против bucket policy против ACL, Block Public Access, шифрование) и классы хранения с lifecycle, где экономия на хранении окупается ценой и задержкой чтения. API S3 стал де-факто стандартом, поэтому всё это переносится на S3-совместимые хранилища: MinIO (self-hosted), Яндекс Object Storage, VK Cloud, Selectel - не только на AWS.

## Концепты

1. **Объектное хранилище: bucket, object, key** - чем объектное хранилище отличается от файловой системы и блочного устройства; плоское пространство имён без настоящих папок (префиксы и delimiter лишь имитируют каталоги); регионы; durability против availability и знаменитые «11 девяток»; метаданные объекта; strong read-after-write консистентность.
2. **Операции через boto3 и пагинация** - client против resource; put_object и get_object; чтение тела как StreamingBody; list_objects_v2 и почему один вызов не отдаёт всё (MaxKeys, IsTruncated, ContinuationToken); delete_object и delete_objects; head_object; high-level upload_file/download_file; multipart upload для больших файлов и докачки.
3. **Presigned URL: временный прямой доступ** - подписанная ссылка, дающая временный доступ без передачи ключей; generate_presigned_url для GET и PUT; presigned POST для загрузки прямо из браузерной формы; срок жизни; разгрузка бэкенда от трафика и риск утечки ссылки.
4. **Доступ: IAM, bucket policy, ACL, шифрование** - identity-based политики против resource-based bucket policy против legacy ACL; Block Public Access; принцип наименьших привилегий; почему явный Deny побеждает Allow; шифрование SSE-S3/SSE-KMS/SSE-C и TLS в транзите; приватность по умолчанию.
5. **Классы хранения, lifecycle и стоимость** - Standard, Standard-IA, One Zone-IA, Glacier Instant/Flexible/Deep Archive и компромисс «дешевле хранить - дороже и дольше читать»; версионирование; lifecycle-правила перехода в холодные классы и истечения старых версий; модель стоимости (хранение, запросы, исходящий трафик egress).

## Prerequisites

Нет. Примеры на boto3 предполагают только базовое знакомство с Python; модель доступа и стоимости разбирается с нуля.

Generated via `lesson-forge`.

---

## English

# S3: Object Storage, boto3, Access, and Cost

A topic for backend developers who store user files, backups, and media in the cloud and want to understand what happens under the hood of S3, rather than copying snippets at random. S3 is not a network drive; it's a flat namespace of string keys with its own access and cost model. We cover the object model (bucket, object, key, and the absence of real folders), working through boto3 with mandatory list pagination and multipart upload, presigned URLs for direct access that bypasses the backend, the security model (IAM versus bucket policy versus ACL, Block Public Access, encryption), and storage classes with lifecycle rules, where savings on storage come at the cost of price and read latency. The S3 API has become a de facto standard, so all of this carries over to S3-compatible storage: MinIO (self-hosted), Yandex Object Storage, VK Cloud, Selectel, not just AWS.

## Concepts

1. **Object storage: bucket, object, key.** How object storage differs from a file system and block storage; the flat namespace with no real folders (prefixes and delimiters only simulate directories); regions; durability versus availability and the famous "eleven nines"; object metadata; strong read-after-write consistency.
2. **S3 operations via boto3 and pagination.** Client versus resource; put_object and get_object; reading the body as a StreamingBody; list_objects_v2 and why a single call doesn't return everything (MaxKeys, IsTruncated, ContinuationToken); delete_object and delete_objects; head_object; the high-level upload_file/download_file; multipart upload for large files and resumable transfers.
3. **Presigned URLs: temporary direct access.** A signed link that grants temporary access without sharing credentials; generate_presigned_url for GET and PUT; presigned POST for uploads straight from a browser form; expiration; offloading traffic from the backend and the risk of a leaked link.
4. **Access control: IAM, bucket policy, ACL, encryption.** Identity-based policies versus resource-based bucket policy versus legacy ACL; Block Public Access; the principle of least privilege; why an explicit Deny always wins over Allow; SSE-S3/SSE-KMS/SSE-C encryption and TLS in transit; private by default.
5. **Storage classes, lifecycle, and cost.** Standard, Standard-IA, One Zone-IA, Glacier Instant/Flexible/Deep Archive and the tradeoff where cheaper storage means slower and pricier reads; versioning; lifecycle rules for transitioning to colder classes and expiring old versions; the cost model (storage, requests, outbound egress traffic).

## Prerequisites

None. The boto3 examples assume only basic familiarity with Python; the access and cost model is covered from scratch.

Generated via `lesson-forge`.
