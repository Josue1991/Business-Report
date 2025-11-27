# Business-Report Microservice

Microservicio de generación de reportes inteligentes con capacidades de Big Data y AI/ML para el ecosistema BusinessApp.

## 🚀 Características

### Generación de Reportes
- **Múltiples formatos**: Excel (.xlsx), PDF, CSV, HTML, JSON
- **Exportación avanzada**: Fórmulas, estilos, gráficos en Excel
- **PDF de alta calidad**: Puppeteer para layouts complejos
- **Streaming**: Manejo eficiente de datasets grandes (hasta 1M de registros en CSV)

### Big Data & Analytics
- **ClickHouse**: Análisis OLAP para consultas agregadas masivas
- **TimescaleDB**: Series de tiempo con hypertables y compresión automática
- **MongoDB**: Metadata de reportes y datos estructurados
- **Consultas optimizadas**: TopN, percentiles, time bucketing, continuous aggregates

### AI & Machine Learning
- **Detección de anomalías**: Z-score, IQR, Isolation Forest
- **Pronósticos**: Regresión lineal, media móvil ponderada, descomposición estacional
- **Sugerencias de KPIs**: OpenAI GPT-4 para indicadores SMART personalizados
- **Análisis de calidad de datos**: Completitud, exactitud, consistencia, outliers
- **Procesamiento de lenguaje natural**: Convierte queries en español a SQL

### Procesamiento Asíncrono
- **BullMQ**: Colas distribuidas con Redis
- **Workers especializados**: 
  - ReportWorker (5 concurrencia) - Generación de reportes
  - MLAnalysisWorker (2 concurrencia) - Análisis AI/ML
- **Tracking de progreso**: 10% → 100% con actualizaciones en tiempo real
- **Reintentos automáticos**: Exponential backoff para fallos

### Integraciones
- **Business-Mensajeria**: Envío de reportes por email
- **Business-Log**: Logging centralizado
- **Kafka**: Event streaming para analytics y auditoría

## 📋 Prerequisitos

- Node.js 20+
- MongoDB 6.0+
- Redis 7.2+
- ClickHouse (opcional)
- TimescaleDB (opcional)
- Docker & Docker Compose (recomendado)

## 🛠️ Instalación

### Desarrollo Local

```bash
# Clonar repositorio
cd Business-Report

# Instalar dependencias
npm install

# Copiar variables de entorno
cp .env.example .env

# Editar .env con tus credenciales
nano .env

# Iniciar servicios en desarrollo
npm run dev

# En otra terminal, iniciar workers
npm run worker:dev
npm run ml-worker:dev
```

### Docker (Recomendado)

```bash
# Crear red compartida (si no existe)
docker network create business-network

# Iniciar todos los servicios
docker-compose up -d

# Ver logs
docker-compose logs -f business-report

# Detener servicios
docker-compose down
```

## 📡 API Endpoints

### Reportes

#### POST `/api/reports`
Genera un nuevo reporte (asíncrono).

```bash
curl -X POST http://localhost:3008/api/reports \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user123",
    "type": "SALES",
    "format": "EXCEL",
    "title": "Ventas Mensuales",
    "data": [
      {"producto": "A", "ventas": 1500, "fecha": "2024-01-15"},
      {"producto": "B", "ventas": 2300, "fecha": "2024-01-16"}
    ],
    "aiAnalysisEnabled": true,
    "emailTo": "usuario@example.com"
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "rep_abc123",
    "status": "PENDING",
    "format": "EXCEL",
    "title": "Ventas Mensuales"
  },
  "message": "Report generation started"
}
```

#### GET `/api/reports?userId=user123`
Lista reportes del usuario.

**Query params:**
- `userId` (required)
- `page` (default: 1)
- `limit` (default: 20)
- `type`: SALES | INVENTORY | FINANCIAL | ANALYTICS | PREDICTIVE | CUSTOM
- `status`: PENDING | PROCESSING | ANALYZING | COMPLETED | FAILED
- `format`: PDF | EXCEL | CSV | HTML | JSON

```bash
curl "http://localhost:3008/api/reports?userId=user123&page=1&limit=10&status=COMPLETED"
```

#### GET `/api/reports/:id`
Obtiene un reporte específico.

```bash
curl http://localhost:3008/api/reports/rep_abc123
```

#### GET `/api/reports/:id/download?userId=user123`
Descarga el archivo del reporte.

```bash
curl -O http://localhost:3008/api/reports/rep_abc123/download?userId=user123
```

#### POST `/api/reports/:id/email`
Envía el reporte por email.

```bash
curl -X POST http://localhost:3008/api/reports/rep_abc123/email \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user123",
    "emailTo": "destinatario@example.com",
    "subject": "Tu reporte mensual",
    "message": "Adjunto encontrarás el reporte solicitado"
  }'
```

### Analytics & AI

#### POST `/api/analytics/analyze`
Ejecuta análisis AI/ML sobre datos.

```bash
curl -X POST http://localhost:3008/api/analytics/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "reportId": "rep_abc123",
    "data": [100, 120, 115, 300, 125, 130],
    "enableAnomalyDetection": true,
    "enableForecasting": true,
    "enableKPISuggestions": true
  }'
```

#### POST `/api/kpis/suggest`
Sugiere KPIs relevantes para un contexto de negocio.

```bash
curl -X POST http://localhost:3008/api/kpis/suggest \
  -H "Content-Type: application/json" \
  -d '{
    "dataSource": "ventas",
    "businessContext": "Empresa de e-commerce con 50K usuarios activos",
    "existingKPIs": ["conversion_rate", "avg_order_value"],
    "maxSuggestions": 5
  }'
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "name": "Customer Lifetime Value (CLV)",
      "description": "Valor total esperado de un cliente durante su relación",
      "formula": "AVG(order_value) * AVG(purchase_frequency) * AVG(customer_lifespan)",
      "importance": 95,
      "category": "revenue",
      "visualizationType": "line"
    }
  ]
}
```

#### POST `/api/analytics/nl-query`
Convierte lenguaje natural a query estructurado.

```bash
curl -X POST http://localhost:3008/api/analytics/nl-query \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user123",
    "query": "Muéstrame las ventas totales por producto en el último mes",
    "dataSource": "ventas"
  }'
```

## 🔧 Configuración

### Variables de Entorno Críticas

```env
# MongoDB
MONGODB_URI=mongodb://localhost:27017
MONGODB_DB_NAME=business_report

# Redis (BullMQ)
REDIS_HOST=localhost
REDIS_PORT=6379

# OpenAI (para KPI suggestions y NLP)
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4

# Analytics Features
ENABLE_ANOMALY_DETECTION=true
ENABLE_FORECASTING=true
ENABLE_KPI_SUGGESTIONS=true
ENABLE_NLP_QUERIES=true

# Report Limits
MAX_ROWS_EXCEL=100000
MAX_ROWS_CSV=1000000
MAX_ROWS_PDF=10000
```

Consulta `.env.example` para la lista completa de 71 variables.

## 🏗️ Arquitectura

```
┌─────────────────────────────────────────────────────────┐
│                    Express API (3008)                    │
│  POST /reports  GET /reports/:id  POST /kpis/suggest   │
└─────────────┬───────────────────────────────────────────┘
              │
              ├──► BullMQ Queues (Redis)
              │      ├─► ReportWorker (5 concurrent)
              │      └─► MLAnalysisWorker (2 concurrent)
              │
              ├──► MongoDB (metadata)
              ├──► ClickHouse (OLAP)
              ├──► TimescaleDB (time-series)
              │
              ├──► AI/ML Services
              │      ├─► AnomalyDetection (TensorFlow.js)
              │      ├─► Forecasting (regression)
              │      ├─► KPISuggestion (OpenAI GPT-4)
              │      ├─► NLPParser (natural + OpenAI)
              │      └─► DataQualityAnalyzer
              │
              ├──► Report Generators
              │      ├─► ExcelGenerator (ExcelJS)
              │      ├─► PDFGenerator (PDFKit)
              │      ├─► PDFAdvancedGenerator (Puppeteer)
              │      └─► CSVGenerator (json2csv)
              │
              └──► External Services
                     ├─► Business-Mensajeria (email)
                     ├─► Business-Log (logging)
                     └─► Kafka (events)
```

### Capas (Hexagonal Architecture)

```
src/
├── domain/           # Entidades y lógica de negocio
│   ├── entities/
│   ├── repositories/
│   └── services/
├── application/      # Casos de uso
│   ├── dtos/
│   └── use-cases/
├── infrastructure/   # Implementaciones técnicas
│   ├── database/
│   ├── bigdata/
│   ├── ai/
│   ├── generators/
│   └── workers/
└── shared/           # Utilidades compartidas
    ├── config.ts
    ├── logger.ts
    ├── errors.ts
    └── validators.ts
```

## 📊 Comparación de Formatos

| Formato | Límite de Filas | Estilos | Gráficos | Fórmulas | Velocidad | Tamaño Archivo |
|---------|----------------|---------|----------|----------|-----------|----------------|
| **Excel** | 100,000 | ✅ | ✅ | ✅ | Media | Grande |
| **PDF** | 10,000 | ✅ | ✅ | ❌ | Lenta | Mediano |
| **CSV** | 1,000,000 | ❌ | ❌ | ❌ | Rápida | Pequeño |
| **HTML** | 50,000 | ✅ | ✅ | ❌ | Rápida | Mediano |
| **JSON** | 100,000 | ❌ | ❌ | ❌ | Muy Rápida | Pequeño |

**Recomendaciones:**
- **Análisis financiero**: Excel (fórmulas y gráficos)
- **Datasets masivos**: CSV (streaming)
- **Presentaciones**: PDF (Puppeteer para layouts complejos)
- **APIs/integraciones**: JSON

## 🤖 Características de AI/ML

### 1. Detección de Anomalías
Identifica valores atípicos usando:
- **Z-score**: Desviaciones estándar (umbral: 2.5σ)
- **IQR**: Rango intercuartílico (Q1-1.5*IQR, Q3+1.5*IQR)
- **Isolation Forest**: Detección basada en densidad

```typescript
// Detecta automáticamente el 300 como anomalía
data: [100, 120, 115, 300, 125, 130]
// Result: { value: 300, score: 4.5, isAnomaly: true }
```

### 2. Pronósticos
Predice valores futuros:
- **Regresión lineal**: Tendencias simples
- **Media móvil ponderada**: Suavizado exponencial
- **Descomposición estacional**: Para datos cíclicos

```typescript
// Forecast 3 periodos adelante
forecast(salesData, 3)
// Returns: [135, 140, 145] con 85% de confianza
```

### 3. Sugerencias de KPIs (OpenAI)
GPT-4 analiza tu contexto de negocio y sugiere KPIs SMART:

```typescript
// Input: "E-commerce con 50K usuarios"
// Output: CLV, Churn Rate, Cart Abandonment, etc.
```

**Costo estimado:** $0.03 - $0.10 por sugerencia (cacheado 24h)

### 4. Natural Language Queries
Escribe queries en español:

```typescript
"Ventas totales por producto en enero 2024"
→ SELECT product, SUM(sales) FROM sales 
   WHERE date >= '2024-01-01' AND date < '2024-02-01'
   GROUP BY product
```

## 🧪 Testing

```bash
# Ejecutar tests
npm test

# Coverage
npm run test:coverage

# Tests específicos
npm test -- --testPathPattern=generators
```

## 📦 Scripts Disponibles

```bash
npm run dev              # Desarrollo (nodemon)
npm run build            # Compilar TypeScript
npm start                # Producción
npm run worker:dev       # Worker de reportes (dev)
npm run ml-worker:dev    # Worker ML (dev)
npm run worker           # Worker de reportes (prod)
npm run ml-worker        # Worker ML (prod)
npm test                 # Tests con Jest
npm run lint             # ESLint
```

## 🔒 Seguridad

- **Helmet.js**: Headers de seguridad HTTP
- **CORS**: Configuración de orígenes permitidos
- **Límites de payload**: 10MB máximo
- **Validación**: Zod schemas en todos los inputs
- **API Key**: Autenticación básica (evolucionar a JWT)

## 🚧 Roadmap

- [ ] Autenticación JWT integrada con Business-Security
- [ ] Webhooks para notificación de reportes completados
- [ ] Scheduler de reportes recurrentes (cron)
- [ ] Dashboard de métricas (Grafana)
- [ ] Caché de queries frecuentes (Redis)
- [ ] Soporte para S3/Azure Blob Storage
- [ ] Exportación a Google Sheets
- [ ] Templates de reportes customizables
- [ ] Rate limiting por usuario

## 📚 Documentación Adicional

- [TECHNOLOGY_GUIDE.md](./TECHNOLOGY_GUIDE.md) - Guía técnica detallada de todas las tecnologías
- [.env.example](./.env.example) - Referencia completa de variables de entorno
- [package.json](./package.json) - Dependencias y versiones

## 🤝 Integración con otros Microservicios

### Business-Mensajeria
Envío de reportes por email:
```typescript
POST http://business-mensajeria:3005/api/emails/send
{
  "to": "user@example.com",
  "subject": "Tu reporte",
  "template": "report-ready",
  "attachments": [{ path: "/storage/report.xlsx" }]
}
```

### Business-Log
Logging centralizado:
```typescript
POST http://business-log:3003/api/logs
{
  "service": "business-report",
  "level": "info",
  "message": "Report generated",
  "metadata": { reportId: "rep_123" }
}
```

### Kafka Events
Publicación de eventos:
```typescript
Topic: report.completed
{
  "reportId": "rep_123",
  "userId": "user123",
  "type": "SALES",
  "format": "EXCEL",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

## 📄 Licencia

Propiedad de BusinessApp © 2024

## 👥 Soporte

Para dudas técnicas o reportes de bugs, contactar al equipo de desarrollo.
