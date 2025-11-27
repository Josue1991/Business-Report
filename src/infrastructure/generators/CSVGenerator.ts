import { parse } from 'json2csv';
import fs from 'fs';
import { Transform } from 'stream';

export interface CSVGeneratorOptions {
  data: any[];
  columns?: string[];
  delimiter?: string;
  includeHeaders?: boolean;
  streaming?: boolean;
}

export class CSVGenerator {
  async generate(options: CSVGeneratorOptions, outputPath: string): Promise<void> {
    if (options.streaming && options.data.length > 10000) {
      return this.generateStreaming(options, outputPath);
    }

    const fields = options.columns || (options.data[0] ? Object.keys(options.data[0]) : []);

    const csv = parse(options.data, {
      fields,
      delimiter: options.delimiter || ',',
      header: options.includeHeaders !== false,
      quote: '"',
      escapedQuote: '""'
    });

    fs.writeFileSync(outputPath, csv, 'utf-8');
  }

  private async generateStreaming(options: CSVGeneratorOptions, outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const writeStream = fs.createWriteStream(outputPath);
      const fields = options.columns || Object.keys(options.data[0]);

      let isFirstChunk = true;

      // Crear stream de transformación
      const transformStream = new Transform({
        objectMode: true,
        transform(chunk: any, encoding, callback) {
          try {
            const csvChunk = parse([chunk], {
              fields,
              header: isFirstChunk && options.includeHeaders !== false,
              delimiter: options.delimiter || ','
            });

            isFirstChunk = false;
            this.push(csvChunk + '\n');
            callback();
          } catch (error) {
            callback(error as Error);
          }
        }
      });

      // Procesar datos en chunks
      let index = 0;
      const chunkSize = 1000;

      const processChunk = () => {
        const chunk = options.data.slice(index, index + chunkSize);
        
        if (chunk.length === 0) {
          transformStream.end();
          return;
        }

        chunk.forEach(item => transformStream.write(item));
        index += chunkSize;

        setImmediate(processChunk);
      };

      processChunk();

      transformStream.pipe(writeStream);

      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
      transformStream.on('error', reject);
    });
  }

  async generateFromCursor(
    cursor: AsyncIterable<any>,
    outputPath: string,
    columns?: string[]
  ): Promise<void> {
    return new Promise(async (resolve, reject) => {
      const writeStream = fs.createWriteStream(outputPath);
      let isFirstRow = true;
      let fields: string[] = [];

      try {
        for await (const doc of cursor) {
          if (isFirstRow) {
            fields = columns || Object.keys(doc);
            
            // Header
            const header = fields.map(f => `"${f}"`).join(',') + '\n';
            writeStream.write(header);
            isFirstRow = false;
          }

          // Fila de datos
          const row = fields.map(field => {
            let value = doc[field];

            if (value === null || value === undefined) {
              return '""';
            }

            if (typeof value === 'string') {
              value = value.replace(/"/g, '""');
              return `"${value}"`;
            }

            if (value instanceof Date) {
              return `"${value.toISOString()}"`;
            }

            return value;
          }).join(',') + '\n';

          writeStream.write(row);
        }

        writeStream.end();
        writeStream.on('finish', resolve);
      } catch (error) {
        reject(error);
      }
    });
  }
}
