import { NextRequest, NextResponse } from 'next/server';
import { logInfo, logError } from '@/lib/logger';

// API endpoint to send scraped data to Make.com
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      propertyUrls = [], 
      makeWebhookUrl, 
      batchSize = 10,
      processingType = 'batch' // 'batch', 'individual', 'bulk'
    } = body;

    if (!makeWebhookUrl) {
      return NextResponse.json(
        { error: 'makeWebhookUrl is required' },
        { status: 400 }
      );
    }

    if (!propertyUrls.length) {
      return NextResponse.json(
        { error: 'No property URLs provided' },
        { status: 400 }
      );
    }

    await logInfo('Starting Make.com data processing', {
      action: 'make_processing_start',
      metadata: { 
        totalUrls: propertyUrls.length, 
        processingType, 
        batchSize,
        makeWebhookUrl: makeWebhookUrl.substring(0, 50) + '...' 
      }
    });

    let results = [];
    let processed = 0;
    let errors = 0;

    switch (processingType) {
      case 'individual':
        // Send each URL individually to Make
        for (const url of propertyUrls) {
          try {
            const response = await fetch(makeWebhookUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                propertyUrl: url,
                source: 'zillow',
                scrapeDate: new Date().toISOString(),
                processingType: 'individual'
              })
            });

            if (response.ok) {
              processed++;
              results.push({ url, status: 'sent', response: 'ok' });
            } else {
              errors++;
              results.push({ url, status: 'error', error: response.statusText });
            }

            // Small delay between requests to Make
            await new Promise(resolve => setTimeout(resolve, 100));

          } catch (error) {
            errors++;
            results.push({ url, status: 'error', error: (error as Error).message });
          }
        }
        break;

      case 'batch':
        // Send URLs in batches
        for (let i = 0; i < propertyUrls.length; i += batchSize) {
          const batch = propertyUrls.slice(i, i + batchSize);
          
          try {
            const response = await fetch(makeWebhookUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                propertyUrls: batch,
                source: 'zillow',
                scrapeDate: new Date().toISOString(),
                processingType: 'batch',
                batchNumber: Math.floor(i / batchSize) + 1,
                totalBatches: Math.ceil(propertyUrls.length / batchSize)
              })
            });

            if (response.ok) {
              processed += batch.length;
              results.push({ 
                batch: Math.floor(i / batchSize) + 1, 
                urls: batch.length, 
                status: 'sent' 
              });
            } else {
              errors += batch.length;
              results.push({ 
                batch: Math.floor(i / batchSize) + 1, 
                urls: batch.length, 
                status: 'error', 
                error: response.statusText 
              });
            }

            // Delay between batches
            await new Promise(resolve => setTimeout(resolve, 500));

          } catch (error) {
            errors += batch.length;
            results.push({ 
              batch: Math.floor(i / batchSize) + 1, 
              urls: batch.length, 
              status: 'error', 
              error: (error as Error).message 
            });
          }
        }
        break;

      case 'bulk':
        // Send all URLs in one request
        try {
          const response = await fetch(makeWebhookUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              propertyUrls,
              source: 'zillow',
              scrapeDate: new Date().toISOString(),
              processingType: 'bulk',
              totalUrls: propertyUrls.length
            })
          });

          if (response.ok) {
            processed = propertyUrls.length;
            results.push({ status: 'sent', urls: propertyUrls.length });
          } else {
            errors = propertyUrls.length;
            results.push({ status: 'error', error: response.statusText, urls: propertyUrls.length });
          }

        } catch (error) {
          errors = propertyUrls.length;
          results.push({ status: 'error', error: (error as Error).message, urls: propertyUrls.length });
        }
        break;
    }

    await logInfo('Make.com processing completed', {
      action: 'make_processing_complete',
      metadata: { 
        totalUrls: propertyUrls.length,
        processed,
        errors,
        processingType 
      }
    });

    return NextResponse.json({
      success: true,
      summary: {
        totalUrls: propertyUrls.length,
        processed,
        errors,
        successRate: Math.round((processed / propertyUrls.length) * 100)
      },
      processingType,
      results
    });

  } catch (error) {
    await logError('Make.com processing failed', {
      action: 'make_processing_error'
    }, error as Error);

    return NextResponse.json(
      { error: 'Internal server error', details: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Make.com Integration API',
    description: 'Send scraped property URLs to Make.com for processing',
    usage: {
      method: 'POST',
      endpoint: '/api/make/webhook',
      body: {
        propertyUrls: ['array of Zillow URLs'],
        makeWebhookUrl: 'Your Make.com webhook URL',
        processingType: 'individual | batch | bulk',
        batchSize: 'number (for batch processing, default: 10)'
      }
    },
    processingTypes: {
      individual: 'Send each URL separately (good for real-time processing)',
      batch: 'Send URLs in batches (balanced approach)',
      bulk: 'Send all URLs in one request (fastest but may hit limits)'
    },
    examples: {
      individual: {
        propertyUrls: ['url1', 'url2'],
        makeWebhookUrl: 'https://hook.make.com/your-webhook-id',
        processingType: 'individual'
      },
      batch: {
        propertyUrls: ['url1', 'url2', 'url3'],
        makeWebhookUrl: 'https://hook.make.com/your-webhook-id',
        processingType: 'batch',
        batchSize: 5
      },
      bulk: {
        propertyUrls: ['url1', 'url2', 'url3'],
        makeWebhookUrl: 'https://hook.make.com/your-webhook-id',
        processingType: 'bulk'
      }
    }
  });
}