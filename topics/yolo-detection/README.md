# YOLO: детекция объектов

Разбор математики одностадийной детекции объектов на примере семейства YOLO: рамки и IoU, сетка и якоря, декодирование выхода сети, Non-Maximum Suppression, компоненты лосса и метрика mAP. Вся практика - детерминированная арифметика детекции, без запуска реальных моделей.

Сгенерировано через `lesson-forge`.

## English (`en`)

Math of single-stage object detection using the YOLO family: bounding boxes and IoU, grid and anchors, decoding network output, Non-Maximum Suppression, loss components, and the mAP metric. All practice is deterministic detection arithmetic. No real models are run.

### Concepts

1. **Detection vs classification**: localization plus class labels for every instance.
2. **Bounding boxes and IoU**: `xywh`/`xyxy` formats and intersection-over-union.
3. **Grid and anchors**: responsible cells and shape-matching anchor boxes.
4. **Decoding output**: sigmoid for center, exponent for size, confidence as a product.
5. **Non-Maximum Suppression**: greedy deduplication of overlapping predictions.
6. **Loss and training**: localization, objectness, classification, and class imbalance.
7. **mAP metrics**: precision, recall, AP, and mean AP across classes and IoU thresholds.

### Prerequisites

`neural-networks`

### Estimated effort

About 4 hours.

### Runtime

Runs entirely in your browser via `pyodide`; no real YOLO weights are loaded.
