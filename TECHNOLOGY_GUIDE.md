# Guía de Tecnologías - Business-Report

## 📚 Índice

1. [Generación de Reportes](#1-generación-de-reportes)
2. [Big Data y Analytics](#2-big-data-y-analytics)
3. [Inteligencia Artificial y Machine Learning](#3-inteligencia-artificial-y-machine-learning)
4. [Procesamiento de Lenguaje Natural (NLP)](#4-procesamiento-de-lenguaje-natural-nlp)
5. [Gestión de Colas y Jobs](#5-gestión-de-colas-y-jobs)
6. [Integración entre Microservicios](#6-integración-entre-microservicios)
7. [Consideraciones de Performance](#7-consideraciones-de-performance)
8. [Guía de Despliegue](#8-guía-de-despliegue)

---

## 1. Generación de Reportes

### 1.1 ExcelJS

**¿Qué es?**  
ExcelJS es una librería de Node.js para leer, manipular y escribir archivos de Excel (.xlsx).

**¿Cuándo usarlo?**
- Reportes con múltiples hojas
- Datos tabulares con fórmulas
- Cuando necesitas estilos, colores y formato avanzado
- Hasta 100,000 registros (configurable)

**Características principales:**
- ✅ Múltiples hojas de cálculo
- ✅ Fórmulas (SUM, AVG, etc.)
- ✅ Estilos (colores, fuentes, bordes)
- ✅ Imágenes y gráficos
- ✅ Filtros y tablas

**Ejemplo básico:**
```javascript
import ExcelJS from 'exceljs';

const workbook = new ExcelJS.Workbook();
const worksheet = workbook.addWorksheet('Ventas');

// Encabezados
worksheet.columns = [
  { header: 'Producto', key: 'product', width: 30 },
  { header: 'Cantidad', key: 'quantity', width: 15 },
  { header: 'Precio', key: 'price', width: 15 }
];

// Datos
worksheet.addRow({ product: 'Laptop', quantity: 10, price: 1200 });

// Estilos
worksheet.getRow(1).font = { bold: true };

await workbook.xlsx.writeFile('reporte.xlsx');
```

**Pros:**
- ✅ Formato profesional
- ✅ Compatible con Excel
- ✅ Fácil de usar

**Contras:**
- ❌ Archivos grandes en memoria
- ❌ No recomendado para +100K filas

---

### 1.2 PDFKit

**¿Qué es?**  
PDFKit es una librería para generar archivos PDF programáticamente en Node.js.

**¿Cuándo usarlo?**
- Reportes con diseño personalizado
- Documentos formales (facturas, certificados)
- Gráficos y texto combinados
- Hasta 10,000 registros

**Características principales:**
- ✅ Control total del diseño
- ✅ Imágenes y gráficos vectoriales
- ✅ Tablas personalizadas
- ✅ Fuentes custom
- ✅ Streaming (genera mientras escribe)

**Ejemplo básico:**
```javascript
import PDFDocument from 'pdfkit';
import fs from 'fs';

const doc = new PDFDocument();
doc.pipe(fs.createWriteStream('reporte.pdf'));

// Título
doc.fontSize(20).text('Reporte de Ventas', { align: 'center' });
doc.moveDown();

// Tabla simple
doc.fontSize(12).text('Producto: Laptop');
doc.text('Cantidad: 10');
doc.text('Precio: $1,200');

doc.end();
```

**Pros:**
- ✅ Diseño flexible
- ✅ Archivos pequeños
- ✅ Streaming

**Contras:**
- ❌ Código manual para layouts complejos
- ❌ Sin soporte HTML/CSS

---

### 1.3 Puppeteer

**¿Qué es?**  
Puppeteer es una librería que controla Chrome/Chromium headless para renderizar HTML/CSS como PDF.

**¿Cuándo usarlo?**
- Diseños complejos con HTML/CSS
- Charts con librerías web (Chart.js)
- Reportes con diseño responsivo
- Cuando necesitas "imprimir" una página web

**Características principales:**
- ✅ Renderiza HTML/CSS completo
- ✅ Soporta JavaScript en la página
- ✅ Charts con Canvas
- ✅ Layout automático
- ✅ Headers y footers personalizados

**Ejemplo básico:**
```javascript
import puppeteer from 'puppeteer';

const browser = await puppeteer.launch();
const page = await browser.newPage();

const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial; }
    .header { background: #007bff; color: white; padding: 20px; }
    table { width: 100%; border-collapse: collapse; }
    td, th { border: 1px solid #ddd; padding: 8px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Reporte de Ventas</h1>
  </div>
  <table>
    <tr><th>Producto</th><th>Cantidad</th></tr>
    <tr><td>Laptop</td><td>10</td></tr>
  </table>
</body>
</html>
`;

await page.setContent(html);
await page.pdf({ path: 'reporte.pdf', format: 'A4' });

await browser.close();
```

**Pros:**
- ✅ Diseño web completo
- ✅ Charts nativos
- ✅ Sin programar layouts

**Contras:**
- ❌ Consume más recursos (Chrome)
- ❌ Más lento que PDFKit
- ❌ Requiere dependencias del sistema

---

### 1.4 json2csv

**¿Qué es?**  
Convierte objetos JavaScript/JSON a formato CSV.

**¿Cuándo usarlo?**
- Datasets grandes (hasta 1M de registros)
- Importación a Excel o bases de datos
- Análisis de datos con Python/R
- Reportes simples sin formato

**Características principales:**
- ✅ Muy rápido
- ✅ Streaming para archivos grandes
- ✅ Personalización de delimitadores
- ✅ Campos anidados

**Ejemplo básico:**
```javascript
import { parse } from 'json2csv';

const data = [
  { product: 'Laptop', quantity: 10, price: 1200 },
  { product: 'Mouse', quantity: 50, price: 25 }
];

const csv = parse(data, {
  fields: ['product', 'quantity', 'price']
});

console.log(csv);
// Output:
// "product","quantity","price"
// "Laptop",10,1200
// "Mouse",50,25
```

**Pros:**
- ✅ Muy ligero
- ✅ Rápido
- ✅ Compatible universal

**Contras:**
- ❌ Sin formato visual
- ❌ No soporta múltiples hojas

---

### Comparación de Formatos

| Formato | Max Registros | Tamaño Archivo | Diseño | Velocidad | Uso Recomendado |
|---------|---------------|----------------|---------|-----------|-----------------|
| **Excel** | 100K | Grande | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | Reportes empresariales con formato |
| **PDF** | 10K | Pequeño | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | Documentos formales, presentaciones |
| **Puppeteer PDF** | 5K | Mediano | ⭐⭐⭐⭐⭐ | ⭐⭐ | Diseños web complejos |
| **CSV** | 1M | Muy pequeño | ⭐ | ⭐⭐⭐⭐⭐ | Datasets grandes, análisis datos |
| **JSON** | 1M | Mediano | N/A | ⭐⭐⭐⭐⭐ | APIs, procesamiento programático |

---

## 2. Big Data y Analytics

### 2.1 ClickHouse

**¿Qué es?**  
ClickHouse es una base de datos columnar OLAP (Online Analytical Processing) ultra-rápida para análisis en tiempo real.

**Conceptos clave:**

**OLAP vs OLTP:**
- **OLTP** (Online Transaction Processing): Bases de datos tradicionales (MySQL, PostgreSQL)
  - Optimizadas para INSERT, UPDATE, DELETE
  - Muchas transacciones pequeñas
  - Ejemplo: Sistema de ventas con pedidos individuales

- **OLAP** (Online Analytical Processing): Bases de datos analíticas (ClickHouse)
  - Optimizadas para consultas agregadas (SUM, AVG, COUNT)
  - Pocas escrituras masivas, muchas lecturas analíticas
  - Ejemplo: "¿Cuántas ventas hubo por región en los últimos 3 meses?"

**Almacenamiento Columnar:**
```
Tradicional (Filas):
Row 1: [Juan, 25, México]
Row 2: [María, 30, España]
Row 3: [Pedro, 28, Argentina]

Columnar (ClickHouse):
Columna Nombre: [Juan, María, Pedro]
Columna Edad: [25, 30, 28]
Columna País: [México, España, Argentina]
```

**Ventajas del almacenamiento columnar:**
- ✅ Solo lee las columnas necesarias
- ✅ Mejor compresión (datos similares juntos)
- ✅ 10-100x más rápido para analytics

**¿Cuándo usar ClickHouse?**
- ✅ Millones de registros para analizar
- ✅ Reportes con agregaciones (SUM, AVG, COUNT)
- ✅ Consultas por rangos de tiempo
- ✅ Logs, eventos, métricas
- ✅ Business Intelligence

**Ejemplo de uso:**
```javascript
import { createClient } from '@clickhouse/client';

const client = createClient({
  host: 'http://localhost:8123',
  database: 'analytics'
});

// Consulta analítica
const result = await client.query({
  query: `
    SELECT 
      toStartOfMonth(order_date) as month,
      region,
      sum(amount) as total_sales,
      count() as order_count,
      avg(amount) as avg_order
    FROM sales
    WHERE order_date >= '2024-01-01'
    GROUP BY month, region
    ORDER BY month DESC, total_sales DESC
  `,
  format: 'JSONEachRow'
});

const data = await result.json();
console.log(data);
```

**Tipos de consultas optimizadas:**
```sql
-- Agregaciones por tiempo
SELECT 
  toStartOfHour(timestamp) as hour,
  count() as events
FROM events
GROUP BY hour;

-- Top N
SELECT 
  product_name,
  sum(quantity) as total
FROM sales
GROUP BY product_name
ORDER BY total DESC
LIMIT 10;

-- Percentiles
SELECT 
  quantile(0.50)(response_time) as p50,
  quantile(0.95)(response_time) as p95,
  quantile(0.99)(response_time) as p99
FROM api_logs;
```

**Pros:**
- ✅ Extremadamente rápido para analytics
- ✅ Escala a billones de registros
- ✅ Compresión excelente

**Contras:**
- ❌ No reemplaza a MongoDB/PostgreSQL
- ❌ No para transacciones ACID
- ❌ Updates y deletes lentos

---

### 2.2 TimescaleDB

**¿Qué es?**  
TimescaleDB es una extensión de PostgreSQL optimizada para datos de series temporales (time-series).

**Conceptos clave:**

**Series Temporales:**
Datos indexados por tiempo donde el tiempo es la dimensión principal.

Ejemplos:
- 📊 Métricas de servidores (CPU, memoria cada minuto)
- 💰 Precios de acciones (precio cada segundo)
- 🌡️ Sensores IoT (temperatura cada 5 minutos)
- 📈 KPIs empresariales (ventas por día)

**Hypertables:**
TimescaleDB convierte tablas normales en "hypertables" que se particionan automáticamente por tiempo.

```sql
-- Crear tabla normal
CREATE TABLE metrics (
  time TIMESTAMPTZ NOT NULL,
  device_id INTEGER,
  temperature DOUBLE PRECISION,
  humidity DOUBLE PRECISION
);

-- Convertir a hypertable (particionada por tiempo)
SELECT create_hypertable('metrics', 'time');

-- TimescaleDB automáticamente particiona por chunks de tiempo
-- Chunk 1: 2024-01-01 a 2024-01-07
-- Chunk 2: 2024-01-08 a 2024-01-14
-- etc.
```

**¿Cuándo usar TimescaleDB?**
- ✅ Datos con timestamp importante
- ✅ Queries por rangos de tiempo
- ✅ Análisis de tendencias temporales
- ✅ Forecasting
- ✅ Monitoreo y observabilidad

**Funciones especiales de TimescaleDB:**

```sql
-- Time bucketing (agrupar por intervalos)
SELECT 
  time_bucket('1 hour', time) as hour,
  device_id,
  avg(temperature) as avg_temp
FROM metrics
WHERE time > NOW() - INTERVAL '1 day'
GROUP BY hour, device_id;

-- Interpolación (llenar gaps)
SELECT 
  time_bucket_gapfill('5 minutes', time) as bucket,
  locf(avg(temperature)) as temperature
FROM metrics
WHERE time > NOW() - INTERVAL '1 hour'
GROUP BY bucket;

-- Continuous aggregates (pre-cálculos automáticos)
CREATE MATERIALIZED VIEW hourly_avg
WITH (timescaledb.continuous) AS
SELECT 
  time_bucket('1 hour', time) as hour,
  device_id,
  avg(temperature) as avg_temp
FROM metrics
GROUP BY hour, device_id;
```

**Compresión automática:**
TimescaleDB comprime chunks antiguos automáticamente:

```sql
-- Configurar compresión
ALTER TABLE metrics SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'device_id'
);

-- Política de compresión: comprimir datos de +7 días
SELECT add_compression_policy('metrics', INTERVAL '7 days');
```

**Ejemplo de uso en Node.js:**
```javascript
import { Client } from 'pg';

const client = new Client({
  host: 'localhost',
  port: 5432,
  database: 'tsdb',
  user: 'postgres',
  password: 'password'
});

await client.connect();

// Query con time_bucket
const result = await client.query(`
  SELECT 
    time_bucket('1 day', timestamp) as day,
    avg(sales_amount) as avg_sales,
    sum(sales_amount) as total_sales
  FROM daily_sales
  WHERE timestamp >= NOW() - INTERVAL '30 days'
  GROUP BY day
  ORDER BY day DESC
`);

console.log(result.rows);
```

**Pros:**
- ✅ Compatible con PostgreSQL (SQL estándar)
- ✅ Optimizado para time-series
- ✅ Compresión automática
- ✅ Funciones analíticas avanzadas

**Contras:**
- ❌ No tan rápido como ClickHouse para agregaciones masivas
- ❌ Requiere PostgreSQL

---

### Cuándo usar cada base de datos:

| Caso de Uso | MongoDB | ClickHouse | TimescaleDB | PostgreSQL |
|-------------|---------|------------|-------------|------------|
| Documentos JSON flexibles | ✅ | ❌ | ❌ | ⚠️ |
| Transacciones ACID | ⚠️ | ❌ | ✅ | ✅ |
| Analytics masivos (billones registros) | ❌ | ✅ | ⚠️ | ❌ |
| Series temporales | ⚠️ | ⚠️ | ✅ | ⚠️ |
| Logs y eventos | ⚠️ | ✅ | ⚠️ | ❌ |
| Relaciones complejas | ❌ | ❌ | ✅ | ✅ |
| Real-time analytics | ⚠️ | ✅ | ⚠️ | ❌ |

---

## 3. Inteligencia Artificial y Machine Learning

### 3.1 TensorFlow.js (Node.js)

**¿Qué es?**  
TensorFlow.js es la versión de TensorFlow para JavaScript que permite entrenar y ejecutar modelos de Machine Learning en Node.js.

**Conceptos clave:**

**Machine Learning básico:**
- **Entrenamiento**: El modelo aprende patrones de datos históricos
- **Inferencia**: El modelo hace predicciones con datos nuevos
- **Modelo**: Algoritmo matemático entrenado

**¿Cuándo usar ML?**
- ✅ Detectar anomalías (gastos inusuales, fraudes)
- ✅ Pronósticos (ventas futuras, demanda)
- ✅ Clasificación (categorizar automáticamente)
- ✅ Clustering (agrupar clientes similares)

**Ejemplo: Detección de Anomalías con Z-Score**

```javascript
import * as tf from '@tensorflow/tfjs-node';
import { mean, standardDeviation } from 'simple-statistics';

class AnomalyDetector {
  // Z-Score: mide cuántas desviaciones estándar está un valor del promedio
  detectAnomalies(data, threshold = 2.5) {
    const avg = mean(data);
    const stdDev = standardDeviation(data);
    
    return data.map((value, index) => {
      const zScore = Math.abs((value - avg) / stdDev);
      return {
        index,
        value,
        zScore,
        isAnomaly: zScore > threshold
      };
    });
  }
}

// Ejemplo
const sales = [100, 105, 98, 102, 500, 97, 103]; // 500 es anómalo
const detector = new AnomalyDetector();
const result = detector.detectAnomalies(sales, 2.5);

console.log(result);
// Output: [..., { index: 4, value: 500, zScore: 3.8, isAnomaly: true }]
```

**Ejemplo: Forecasting con Regresión Lineal**

```javascript
import { linearRegression, linearRegressionLine } from 'simple-statistics';

class ForecastingService {
  forecast(historicalData, periods) {
    // Convertir a puntos (x, y)
    const points = historicalData.map((value, index) => [index, value]);
    
    // Calcular regresión lineal
    const regression = linearRegression(points);
    const line = linearRegressionLine(regression);
    
    // Predecir siguientes períodos
    const lastIndex = historicalData.length - 1;
    const forecasts = [];
    
    for (let i = 1; i <= periods; i++) {
      const forecast = line(lastIndex + i);
      forecasts.push(Math.max(0, forecast)); // No negativos
    }
    
    return {
      forecasts,
      trend: regression.m > 0 ? 'upward' : regression.m < 0 ? 'downward' : 'stable',
      slope: regression.m
    };
  }
}

// Ejemplo
const monthlySales = [1000, 1050, 1100, 1200, 1250, 1300];
const forecaster = new ForecastingService();
const prediction = forecaster.forecast(monthlySales, 3);

console.log(prediction);
// Output: { forecasts: [1350, 1400, 1450], trend: 'upward', slope: 50 }
```

**Ejemplo: Clustering con K-Means**

```javascript
import kmeans from 'ml-kmeans';

class CustomerSegmentation {
  segmentCustomers(customers, numSegments = 3) {
    // customers = [{ purchases: 10, avgSpent: 500 }, ...]
    
    const data = customers.map(c => [c.purchases, c.avgSpent]);
    
    const result = kmeans(data, numSegments, {
      initialization: 'kmeans++'
    });
    
    // Asignar cluster a cada customer
    return customers.map((customer, i) => ({
      ...customer,
      segment: result.clusters[i],
      centroid: result.centroids[result.clusters[i]]
    }));
  }
}

// Ejemplo
const customers = [
  { id: 1, purchases: 2, avgSpent: 50 },   // Segment 0: Low value
  { id: 2, purchases: 50, avgSpent: 1000 }, // Segment 2: High value
  { id: 3, purchases: 10, avgSpent: 200 }   // Segment 1: Medium value
];

const segmenter = new CustomerSegmentation();
const segments = segmenter.segmentCustomers(customers);

console.log(segments);
```

**Limitaciones de TensorFlow.js en Node.js:**
- ❌ Más lento que TensorFlow Python
- ❌ Menos algoritmos disponibles
- ❌ Dificulta el training de modelos grandes
- ✅ Bueno para inferencia de modelos pre-entrenados
- ✅ Excelente para modelos simples (regresión, clustering)

**Pros:**
- ✅ Todo en JavaScript
- ✅ No requiere Python
- ✅ Bueno para modelos simples

**Contras:**
- ❌ Limitado vs Python
- ❌ Menos librerías ML

---

### 3.2 OpenAI GPT-4

**¿Qué es?**  
OpenAI GPT-4 es un modelo de lenguaje avanzado (LLM) que entiende y genera texto natural.

**¿Cuándo usarlo?**
- ✅ Consultas en lenguaje natural a SQL
- ✅ Sugerencias inteligentes de KPIs
- ✅ Análisis y resúmenes de datos
- ✅ Insights automáticos

**Conceptos clave:**

**Tokens:**
- Unidad mínima de procesamiento (~4 caracteres)
- GPT-4: Límite de 8K-128K tokens por request
- Se cobra por tokens consumidos

**Prompt Engineering:**
Cómo escribir instrucciones efectivas para el modelo.

**Ejemplo: Sugerir KPIs con OpenAI**

```javascript
import OpenAI from 'openai';

class KPISuggestionService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  async suggestKPIs(dataSource, businessContext) {
    const prompt = `
Eres un experto en Business Intelligence. Analiza el siguiente contexto y sugiere 5 KPIs relevantes.

Fuente de datos: ${dataSource}
Contexto empresarial: ${businessContext}

Para cada KPI proporciona:
1. Nombre del KPI
2. Descripción breve
3. Fórmula de cálculo
4. Importancia (high/medium/low)
5. Categoría (financiero, operacional, marketing, etc.)
6. Tipo de visualización recomendada

Formato de respuesta en JSON.
    `;

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: 'Eres un analista de datos experto.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 2000
    });

    const kpis = JSON.parse(response.choices[0].message.content);
    return kpis;
  }
}

// Ejemplo de uso
const service = new KPISuggestionService();
const kpis = await service.suggestKPIs(
  'Tabla de ventas con: fecha, producto, cantidad, precio, cliente, región',
  'E-commerce de electrónica con operación nacional'
);

console.log(kpis);
/* Output:
[
  {
    name: "Revenue Growth Rate",
    description: "Tasa de crecimiento mensual de ingresos",
    formula: "((Ventas Mes Actual - Ventas Mes Anterior) / Ventas Mes Anterior) * 100",
    importance: "high",
    category: "financiero",
    visualizationType: "line"
  },
  {
    name: "Average Order Value (AOV)",
    description: "Valor promedio por pedido",
    formula: "SUM(precio * cantidad) / COUNT(DISTINCT pedido)",
    importance: "high",
    category: "marketing",
    visualizationType: "gauge"
  },
  ...
]
*/
```

**Ejemplo: Natural Language to SQL**

```javascript
class NLPQueryParser {
  async parse(naturalQuery, schema) {
    const prompt = `
Convierte la siguiente consulta en lenguaje natural a SQL.

Esquema de la base de datos:
${schema}

Consulta del usuario:
"${naturalQuery}"

Genera SOLO la query SQL sin explicaciones.
    `;

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: 'Convierte lenguaje natural a SQL.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.1, // Baja temperatura para respuestas precisas
      max_tokens: 500
    });

    return response.choices[0].message.content.trim();
  }
}

// Ejemplo
const parser = new NLPQueryParser();
const sql = await parser.parse(
  "Muéstrame las ventas totales por región del último mes",
  `
  Tabla: sales
  Columnas: id, date, region, product, amount
  `
);

console.log(sql);
/* Output:
SELECT 
  region,
  SUM(amount) as total_sales
FROM sales
WHERE date >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH)
GROUP BY region
ORDER BY total_sales DESC;
*/
```

**Consideraciones de Costo:**

GPT-4 Pricing (ejemplo):
- Input: $0.03 por 1K tokens
- Output: $0.06 por 1K tokens

Request típico de KPI suggestions:
- Prompt: ~500 tokens ($0.015)
- Respuesta: ~1000 tokens ($0.06)
- **Total: ~$0.075 por request**

Para 1,000 reportes/mes con IA: **~$75/mes**

**Estrategias de optimización:**
1. ✅ Cachear sugerencias comunes
2. ✅ Usar GPT-3.5 para tareas simples (10x más barato)
3. ✅ Batch similar requests
4. ✅ Limitar max_tokens

**Pros:**
- ✅ Resultados impresionantes
- ✅ Entiende contexto empresarial
- ✅ No requiere training

**Contras:**
- ❌ Costo por uso
- ❌ Latencia (1-5 segundos)
- ❌ Requiere API key
- ❌ Requiere internet

---

## 4. Procesamiento de Lenguaje Natural (NLP)

### 4.1 Natural (NLP Library)

**¿Qué es?**  
Natural es una librería de NLP para Node.js con funciones básicas de procesamiento de lenguaje.

**Funciones principales:**

**Tokenization:**
Dividir texto en palabras/tokens.

```javascript
import natural from 'natural';

const tokenizer = new natural.WordTokenizer();
const text = "Muéstrame ventas totales por región";
const tokens = tokenizer.tokenize(text);

console.log(tokens);
// Output: ['Muéstrame', 'ventas', 'totales', 'por', 'región']
```

**Stemming:**
Reducir palabras a su raíz.

```javascript
const { PorterStemmer } = natural;

console.log(PorterStemmer.stem('vendiendo')); // 'vend'
console.log(PorterStemmer.stem('ventas'));    // 'venta'
console.log(PorterStemmer.stem('vendedor'));  // 'vended'
```

**Clasificación de Texto:**

```javascript
const classifier = new natural.BayesClassifier();

// Entrenar
classifier.addDocument('mostrar ventas totales', 'query-sales');
classifier.addDocument('ver ingresos mensuales', 'query-sales');
classifier.addDocument('listar productos', 'query-products');
classifier.addDocument('inventario actual', 'query-inventory');

classifier.train();

// Clasificar
console.log(classifier.classify('dame las ventas del mes'));
// Output: 'query-sales'
```

**Pros:**
- ✅ Rápido y offline
- ✅ No requiere API
- ✅ Gratis

**Contras:**
- ❌ Básico vs OpenAI
- ❌ Menor precisión

---

### 4.2 Simple Statistics

**¿Qué es?**  
Librería de estadísticas para JavaScript con funciones matemáticas comunes.

**Funciones útiles:**

```javascript
import {
  mean, median, mode, standardDeviation,
  variance, quantile, linearRegression,
  rSquared, sampleCorrelation
} from 'simple-statistics';

const data = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

console.log(mean(data));              // 55
console.log(median(data));            // 55
console.log(standardDeviation(data)); // 30.27
console.log(quantile(data, 0.95));    // 95 (percentil 95)

// Correlación entre dos variables
const sales = [100, 120, 130, 140, 150];
const marketing = [10, 15, 12, 18, 20];
console.log(sampleCorrelation(sales, marketing)); // 0.85
```

**Uso en Data Quality:**

```javascript
class DataQualityAnalyzer {
  analyze(data) {
    const values = data.map(d => d.value).filter(v => v != null);
    
    return {
      completeness: (values.length / data.length) * 100,
      mean: mean(values),
      median: median(values),
      stdDev: standardDeviation(values),
      outliers: this.detectOutliers(values).length,
      min: Math.min(...values),
      max: Math.max(...values)
    };
  }

  detectOutliers(values) {
    const q1 = quantile(values, 0.25);
    const q3 = quantile(values, 0.75);
    const iqr = q3 - q1;
    
    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;
    
    return values.filter(v => v < lowerBound || v > upperBound);
  }
}
```

---

## 5. Gestión de Colas y Jobs

### 5.1 BullMQ

**¿Qué es?**  
BullMQ es una librería robusta para gestionar colas de trabajos (jobs) usando Redis.

**Conceptos clave:**

**¿Por qué usar colas?**
- ✅ Procesos largos no bloquean el servidor
- ✅ Reintentos automáticos si falla
- ✅ Prioridades entre jobs
- ✅ Escalabilidad (múltiples workers)

**Arquitectura:**

```
API Server (Express)
    ↓ 
  enqueue job
    ↓
Redis Queue
    ↓
Worker Process (background)
    ↓
  Genera reporte
    ↓
Actualiza MongoDB
```

**Ciclo de vida de un Job:**

```
waiting → active → completed
              ↓
            failed
              ↓
            retry → waiting
```

**Ejemplo completo:**

```javascript
import { Queue, Worker } from 'bullmq';
import Redis from 'ioredis';

// Conexión Redis
const connection = new Redis({
  host: 'localhost',
  port: 6379,
  maxRetriesPerRequest: null
});

// 1. Crear cola
const reportQueue = new Queue('reports', { connection });

// 2. Agregar job (desde API)
app.post('/api/reports', async (req, res) => {
  const job = await reportQueue.add('generate-report', {
    reportId: '123',
    format: 'PDF',
    data: [...]
  }, {
    attempts: 3,              // Reintentar 3 veces
    backoff: {
      type: 'exponential',    // 1s, 2s, 4s, 8s...
      delay: 5000
    },
    priority: 1,              // Menor = mayor prioridad
    removeOnComplete: 100,    // Mantener últimos 100
    removeOnFail: 500         // Mantener últimos 500 errores
  });

  res.json({ jobId: job.id });
});

// 3. Worker (proceso separado)
const worker = new Worker('reports', async (job) => {
  console.log(`Procesando job ${job.id}`);
  
  // Actualizar progreso
  await job.updateProgress(20);
  
  // Generar reporte (lógica real)
  const result = await generatePDF(job.data);
  
  await job.updateProgress(100);
  
  return result;
}, {
  connection,
  concurrency: 5  // 5 jobs en paralelo
});

// Eventos del worker
worker.on('completed', (job, result) => {
  console.log(`✅ Job ${job.id} completado`);
});

worker.on('failed', (job, error) => {
  console.error(`❌ Job ${job.id} falló:`, error);
});

worker.on('progress', (job, progress) => {
  console.log(`Job ${job.id}: ${progress}%`);
});
```

**Patrones avanzados:**

**1. Jobs Recurrentes (Cron):**

```javascript
// Limpiar reportes expirados cada día a las 2 AM
await reportQueue.add('cleanup', {}, {
  repeat: {
    pattern: '0 2 * * *'  // Cron syntax
  }
});
```

**2. Delay:**

```javascript
// Enviar email en 1 hora
await emailQueue.add('send-reminder', { ... }, {
  delay: 60 * 60 * 1000  // 1 hora en ms
});
```

**3. Priority:**

```javascript
// Jobs de pago tienen prioridad
await reportQueue.add('generate', { userId: 'premium' }, {
  priority: 1  // Alta prioridad
});

await reportQueue.add('generate', { userId: 'free' }, {
  priority: 10  // Baja prioridad
});
```

**Monitoreo:**

```javascript
// Obtener métricas
const counts = await reportQueue.getJobCounts();
console.log(counts);
// { waiting: 5, active: 2, completed: 1000, failed: 10 }

// Pausar cola
await reportQueue.pause();

// Reanudar
await reportQueue.resume();
```

**Pros:**
- ✅ Muy robusto
- ✅ Reintentos automáticos
- ✅ Monitoreo built-in
- ✅ Escalable

**Contras:**
- ❌ Requiere Redis
- ❌ Complejidad adicional

---

## 6. Integración entre Microservicios

### 6.1 Kafka (Event Streaming)

**¿Qué es?**  
Apache Kafka es una plataforma de streaming distribuida para eventos en tiempo real.

**Conceptos clave:**

**Event-Driven Architecture:**
Los servicios se comunican mediante eventos asincrónicos.

```
Business-Report (Producer)
    ↓ publica evento
Kafka Topic: "report.completed"
    ↓ consume evento
Business-Notificaciones (Consumer)
    ↓
Notifica al usuario
```

**Ejemplo:**

```javascript
import { Kafka } from 'kafkajs';

const kafka = new Kafka({
  clientId: 'business-report',
  brokers: ['localhost:9092']
});

// Producer (Business-Report)
const producer = kafka.producer();
await producer.connect();

await producer.send({
  topic: 'report.completed',
  messages: [{
    key: reportId,
    value: JSON.stringify({
      reportId,
      userId,
      title: 'Reporte de Ventas',
      downloadUrl: 'https://...',
      completedAt: new Date()
    })
  }]
});

// Consumer (Business-Notificaciones)
const consumer = kafka.consumer({ groupId: 'notifications' });
await consumer.connect();
await consumer.subscribe({ topic: 'report.completed' });

await consumer.run({
  eachMessage: async ({ topic, partition, message }) => {
    const event = JSON.parse(message.value.toString());
    
    // Enviar notificación
    await sendNotification(event.userId, {
      title: 'Reporte Listo',
      message: `Tu reporte "${event.title}" está disponible`,
      data: { reportId: event.reportId }
    });
  }
});
```

**Cuándo usar Kafka vs HTTP:**

| Escenario | Kafka | HTTP |
|-----------|-------|------|
| Notificaciones async | ✅ | ❌ |
| Respuesta inmediata | ❌ | ✅ |
| Múltiples consumidores | ✅ | ❌ |
| Orden garantizado | ✅ | ❌ |
| Retry automático | ✅ | ⚠️ |

---

### 6.2 HTTP/REST APIs

**¿Cuándo usar?**
- ✅ Request-response síncrono
- ✅ Consultas de datos
- ✅ Operaciones CRUD

**Ejemplo: Enviar Email via Business-Mensajeria**

```javascript
import axios from 'axios';

async function sendReportByEmail(report, emailTo) {
  const fileBuffer = fs.readFileSync(report.filePath);
  const fileBase64 = fileBuffer.toString('base64');

  const response = await axios.post(
    `${process.env.MENSAJERIA_SERVICE_URL}/api/email/send`,
    {
      to: emailTo,
      subject: `Reporte: ${report.metadata.title}`,
      templateName: 'report-email',
      variables: {
        reportTitle: report.metadata.title,
        createdAt: report.createdAt
      },
      attachments: [{
        filename: report.getFileName(),
        content: fileBase64,
        encoding: 'base64'
      }]
    },
    {
      headers: {
        'x-api-key': process.env.API_KEY
      },
      timeout: 30000
    }
  );

  return response.data;
}
```

---

## 7. Consideraciones de Performance

### 7.1 Límites por Formato

```javascript
const LIMITS = {
  EXCEL: 100000,   // 100K registros
  CSV: 1000000,    // 1M registros
  PDF: 10000,      // 10K registros
  HTML: 50000,     // 50K registros
  JSON: 1000000    // 1M registros
};
```

### 7.2 Streaming para Archivos Grandes

**CSV con Streaming:**

```javascript
import { Transform } from 'stream';
import { parse } from 'json2csv';

async function generateLargeCSV(query, filePath) {
  const writeStream = fs.createWriteStream(filePath);
  
  // Cursor de MongoDB (streaming)
  const cursor = db.collection('sales').find(query).stream();
  
  let isFirstChunk = true;
  
  cursor.pipe(new Transform({
    objectMode: true,
    transform(doc, encoding, callback) {
      if (isFirstChunk) {
        // Header
        this.push(parse([doc], { header: true }));
        isFirstChunk = false;
      } else {
        // Sin header
        this.push(parse([doc], { header: false }));
      }
      callback();
    }
  })).pipe(writeStream);
  
  return new Promise((resolve, reject) => {
    writeStream.on('finish', resolve);
    writeStream.on('error', reject);
  });
}
```

### 7.3 Paginación en Queries

```javascript
// Malo: Trae todo a memoria
const allData = await db.collection('sales').find().toArray();

// Bueno: Paginado
async function* fetchBatch(collection, query, batchSize = 1000) {
  let skip = 0;
  
  while (true) {
    const batch = await collection
      .find(query)
      .skip(skip)
      .limit(batchSize)
      .toArray();
    
    if (batch.length === 0) break;
    
    yield batch;
    skip += batchSize;
  }
}

// Uso
for await (const batch of fetchBatch(db.collection('sales'), {}, 1000)) {
  await processData(batch);
}
```

---

## 8. Guía de Despliegue

### 8.1 Variables de Entorno Críticas

```bash
# Bases de datos
MONGODB_URI=mongodb://localhost:27017
CLICKHOUSE_HOST=http://localhost:8123
TIMESCALE_HOST=localhost

# OpenAI (opcional pero recomendado para IA)
OPENAI_API_KEY=sk-...

# Límites
MAX_ROWS_EXCEL=100000
MAX_ROWS_CSV=1000000

# ML
ML_TRAINING_ENABLED=true
ENABLE_ANOMALY_DETECTION=true
ENABLE_FORECASTING=true
ENABLE_KPI_SUGGESTIONS=true
```

### 8.2 Docker Compose

Ver `docker-compose.yml` en el proyecto para la configuración completa con:
- MongoDB
- Redis (BullMQ)
- ClickHouse
- TimescaleDB
- Kafka + Zookeeper

### 8.3 Proceso de Inicialización

1. **Instalar dependencias:**
```bash
npm install
```

2. **Inicializar bases de datos:**
```bash
# ClickHouse
docker exec -it clickhouse clickhouse-client
CREATE DATABASE analytics;

# TimescaleDB
docker exec -it timescale psql -U postgres
CREATE DATABASE tsdb;
\c tsdb
CREATE EXTENSION IF NOT EXISTS timescaledb;
```

3. **Entrenar modelos ML (opcional):**
```bash
npm run ml:train
```

4. **Iniciar servicios:**
```bash
# Desarrollo
npm run dev          # API Server
npm run worker:dev   # Worker (otra terminal)

# Producción
npm run build
npm start
npm run worker
```

---

## 9. Resumen Rápido

### ¿Cuándo usar qué?

**Generación de Reportes:**
- 📊 Excel: Reportes empresariales con formato
- 📄 PDF (PDFKit): Documentos simples rápidos
- 🌐 PDF (Puppeteer): Diseños complejos HTML/CSS
- 📝 CSV: Datasets grandes, análisis datos
- 🔗 JSON: APIs, procesamiento programático

**Análisis de Datos:**
- 🗄️ ClickHouse: Analytics masivos (millones de registros)
- ⏱️ TimescaleDB: Series temporales, pronósticos
- 🧠 TensorFlow.js: ML simple (anomalías, clustering)
- 🤖 OpenAI: NLP, sugerencias inteligentes

**Arquitectura:**
- 🔄 BullMQ: Jobs asincrónicos (reportes largos)
- 📡 Kafka: Eventos entre microservicios
- 🌐 HTTP: Request-response síncrono

### Preguntas Frecuentes

**Q: ¿Es necesario usar ClickHouse?**  
A: No. Puedes usar solo MongoDB si tus reportes son < 100K registros. ClickHouse es para analytics masivos.

**Q: ¿Necesito OpenAI para todo?**  
A: No. La IA es opcional. Puedes deshabilitarla con `AI_ANALYSIS_ENABLED=false`.

**Q: ¿TensorFlow.js es suficiente?**  
A: Para detección de anomalías básicas y forecasting simple, sí. Para modelos complejos, usa Python.

**Q: ¿Cuánto cuesta OpenAI por mes?**  
A: Depende del uso. Estimado: $50-200/mes para 1,000-5,000 reportes con IA.

**Q: ¿Qué formato es más rápido?**  
A: CSV es el más rápido. PDF con Puppeteer es el más lento.

---

## 10. Referencias

- **ExcelJS**: https://github.com/exceljs/exceljs
- **PDFKit**: https://pdfkit.org/
- **Puppeteer**: https://pptr.dev/
- **ClickHouse**: https://clickhouse.com/docs
- **TimescaleDB**: https://docs.timescale.com/
- **TensorFlow.js**: https://www.tensorflow.org/js
- **OpenAI**: https://platform.openai.com/docs
- **BullMQ**: https://docs.bullmq.io/
- **Kafka**: https://kafka.js.org/

---

**¿Dudas?** Revisa los ejemplos en el código o consulta la documentación oficial de cada tecnología.
