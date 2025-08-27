// netlify/functions/send-email.js
// Email sending function using SendGrid API
// Updated to use SendGrid instead of SMTP for better reliability

import sgMail from '@sendgrid/mail';

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { emails, reportData, pdfData } = body;

    // Validate input
    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return { 
        statusCode: 400, 
        body: JSON.stringify({ error: 'Missing or invalid email addresses' }) 
      };
    }

    if (!reportData || !pdfData) {
      return { 
        statusCode: 400, 
        body: JSON.stringify({ error: 'Missing report data or PDF data' }) 
      };
    }

    // Validate and sanitize report data
    const safeReportData = {
      placeTypology: reportData.placeTypology || 'Unknown',
      totalPlaces: Number(reportData.totalPlaces) || 0,
      areaAcres: Number(reportData.areaAcres) || 0,
      totalBudget: Number(reportData.totalBudget) || 0
    };

    // Validate required environment variables
    if (!process.env.SENDGRID_API_KEY) {
      return { 
        statusCode: 500, 
        body: JSON.stringify({ error: 'Missing SendGrid API key configuration' }) 
      };
    }

    if (!process.env.SENDGRID_FROM_EMAIL) {
      return { 
        statusCode: 500, 
        body: JSON.stringify({ error: 'Missing SendGrid from email configuration' }) 
      };
    }

    // Debug: Log API key format (first/last 5 chars only for security)
    const apiKey = process.env.SENDGRID_API_KEY;
    console.log('API Key format check:', {
      hasKey: !!apiKey,
      keyLength: apiKey?.length,
      startsWithSG: apiKey?.startsWith('SG.'),
      keyPreview: apiKey ? `${apiKey.substring(0, 5)}...${apiKey.substring(apiKey.length - 5)}` : 'none'
    });

    // Set SendGrid API key
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);

    // Prepare email content
    const subject = `BID Budget Analysis Report - ${safeReportData.placeTypology}`;
    const fromName = process.env.SENDGRID_FROM_NAME || 'BID Budget Estimator';
    const fromEmail = process.env.SENDGRID_FROM_EMAIL;
    
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; 
            line-height: 1.6; 
            color: #333; 
            max-width: 600px; 
            margin: 0 auto; 
            padding: 20px; 
          }
          .header { 
            background: linear-gradient(135deg, #f37129, #0feaa6); 
            color: white; 
            padding: 30px 20px; 
            border-radius: 8px; 
            text-align: center; 
            margin-bottom: 30px; 
          }
          .header h1 { margin: 0; font-size: 24px; font-weight: 600; }
          .header p { margin: 5px 0 0; opacity: 0.95; }
          .summary { 
            background: #f8fafc; 
            padding: 20px; 
            border-radius: 8px; 
            margin-bottom: 20px; 
            border-left: 4px solid #f37129;
          }
          .metric { 
            display: flex; 
            justify-content: space-between; 
            padding: 8px 0; 
            border-bottom: 1px solid #e2e8f0; 
          }
          .metric:last-child { border-bottom: none; }
          .metric strong { color: #1e293b; }
          .footer { 
            text-align: center; 
            color: #64748b; 
            font-size: 14px; 
            margin-top: 30px; 
            padding-top: 20px; 
            border-top: 1px solid #e2e8f0; 
          }
          .features { 
            background: #f0f9ff; 
            padding: 20px; 
            border-radius: 8px; 
            margin: 20px 0; 
          }
          .features ul { margin: 0; padding-left: 20px; }
          .features li { margin-bottom: 8px; }
          .logo { color: #f37129; font-weight: 600; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🏙️ BID Budget Analysis Report</h1>
          <p>Professional budget estimation for your district</p>
        </div>
        
        <p>Hello,</p>
        
        <p>Please find attached your comprehensive <strong>Business Improvement District (BID) budget analysis report</strong>. This report contains detailed calculations and recommendations based on industry standards and real-world district data.</p>
        
        <div class="summary">
          <h3 style="margin-top: 0; color: #f37129;">📊 Report Summary</h3>
          <div class="metric">
            <span><strong>District Type:</strong></span>
            <span>${safeReportData.placeTypology}</span>
          </div>
          <div class="metric">
            <span><strong>Total Businesses:</strong></span>
            <span>${safeReportData.totalPlaces.toLocaleString()}</span>
          </div>
          <div class="metric">
            <span><strong>Coverage Area:</strong></span>
            <span>${safeReportData.areaAcres.toFixed(1)} acres</span>
          </div>
          <div class="metric">
            <span><strong>Annual Budget Estimate:</strong></span>
            <span><strong style="color: #f37129; font-size: 1.1em;">$${safeReportData.totalBudget.toLocaleString()}</strong></span>
          </div>
          <div class="metric">
            <span><strong>Cost per Business:</strong></span>
            <span>$${(safeReportData.totalPlaces > 0 ? Math.round(safeReportData.totalBudget / safeReportData.totalPlaces) : 0).toLocaleString()}</span>
          </div>
        </div>
        
        <div class="features">
          <h3 style="margin-top: 0; color: #034744;">📋 What's Included in Your Report:</h3>
          <ul>
            <li><strong>Executive Summary:</strong> Key metrics and budget allocation breakdown</li>
            <li><strong>Service Details:</strong> Cleaning, safety, marketing, and streetscape analysis</li>
            <li><strong>Staffing Estimates:</strong> FTE requirements and coverage recommendations</li>
            <li><strong>Priority Services:</strong> Data-driven recommendations based on your business mix</li>
            <li><strong>Interactive Map:</strong> Visual overview of your district boundaries</li>
            <li><strong>Methodology Documentation:</strong> Industry-standard calculation explanations</li>
          </ul>
        </div>
        
        <p>This analysis is powered by <strong>real-world business data from Overture Maps</strong> and follows <strong>International Downtown Association (IDA) standards</strong> for BID budget planning. The attached PDF is ready for board presentations and stakeholder discussions.</p>
        
        <p>If you have any questions about the analysis or would like to discuss customizations for your specific district needs, please don't hesitate to reach out.</p>
        
        <p>Best regards,<br>
        <strong>The Ginkgo Team</strong></p>
        
        <div class="footer">
          <p><strong class="logo">Ginkgo BID Budget Estimator</strong><br>
          Professional budget analysis tool powered by Overture Maps data<br>
          <em>Report generated on ${new Date().toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })}</em></p>
        </div>
      </body>
      </html>
    `;

    const textContent = `
BID Budget Analysis Report - ${reportData.placeTypology}

Hello,

Please find attached your comprehensive Business Improvement District (BID) budget analysis report.

REPORT SUMMARY:
• District Type: ${safeReportData.placeTypology}
• Total Businesses: ${safeReportData.totalPlaces.toLocaleString()}  
• Coverage Area: ${safeReportData.areaAcres.toFixed(1)} acres
• Annual Budget Estimate: $${safeReportData.totalBudget.toLocaleString()}
• Cost per Business: $${(safeReportData.totalPlaces > 0 ? Math.round(safeReportData.totalBudget / safeReportData.totalPlaces) : 0).toLocaleString()}

WHAT'S INCLUDED:
• Executive Summary with key metrics and budget breakdown
• Service Details for cleaning, safety, marketing, and streetscape
• Staffing Estimates and coverage recommendations
• Priority Services based on your business mix
• Interactive map of your district
• Methodology documentation

This analysis follows International Downtown Association (IDA) standards and is powered by real-world business data from Overture Maps.

Best regards,
The Ginkgo Team

---
Ginkgo BID Budget Estimator
Report generated on ${new Date().toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    })}
    `;

    // Prepare email data for SendGrid
    const msg = {
      to: emails.map(email => email.trim()),
      from: {
        email: fromEmail,
        name: fromName
      },
      subject: subject,
      text: textContent,
      html: htmlContent,
      attachments: [
        {
          content: pdfData,
          filename: `BID-Budget-Report-${new Date().toISOString().split('T')[0]}.pdf`,
          type: 'application/pdf',
          disposition: 'attachment'
        }
      ],
      // SendGrid tracking settings
      tracking_settings: {
        click_tracking: {
          enable: true
        },
        open_tracking: {
          enable: true
        }
      },
      // Custom categories for analytics
      categories: ['bid-budget-report', 'pdf-export']
    };

    // Send email using SendGrid
    await sgMail.send(msg);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        success: true, 
        message: `Report successfully sent to ${emails.length} recipient${emails.length > 1 ? 's' : ''}`,
        details: {
          recipientCount: emails.length,
          reportType: safeReportData.placeTypology,
          totalBudget: safeReportData.totalBudget,
          sentAt: new Date().toISOString()
        }
      })
    };

  } catch (error) {
    console.error('SendGrid email error:', error);
    
    // Handle SendGrid specific errors
    if (error.code === 401) {
      // Check if it's actually a credit limit issue (SendGrid returns 401 for this)
      const isCreditsExceeded = error.response?.body?.errors?.some(e => 
        e.message?.toLowerCase().includes('maximum credits exceeded')
      );
      
      if (isCreditsExceeded) {
        return { 
          statusCode: 500, 
          body: JSON.stringify({ 
            error: 'SendGrid daily sending limit exceeded',
            details: 'Your SendGrid account has reached its daily limit (100 emails for free accounts). The limit resets at midnight UTC. To send more emails, please upgrade your SendGrid plan.',
            solution: 'Wait for the daily reset or upgrade at https://sendgrid.com/pricing/'
          }) 
        };
      }
      
      return { 
        statusCode: 500, 
        body: JSON.stringify({ 
          error: 'SendGrid authentication failed. Please check your API key.',
          details: 'Verify that your SendGrid API key is valid and has mail send permissions.'
        }) 
      };
    } else if (error.code === 403) {
      return { 
        statusCode: 500, 
        body: JSON.stringify({ 
          error: 'SendGrid permission denied. Please check your account status.',
          details: 'Ensure your SendGrid account is active and the from email is verified.'
        }) 
      };
    } else if (error.response?.body?.errors?.some(e => e.message?.includes('Maximum credits exceeded'))) {
      return { 
        statusCode: 500, 
        body: JSON.stringify({ 
          error: 'SendGrid daily limit exceeded',
          details: 'Your SendGrid account has reached its daily sending limit. Please upgrade your plan or wait for the daily reset.'
        }) 
      };
    } else if (error.response) {
      // SendGrid API error response
      return { 
        statusCode: 500, 
        body: JSON.stringify({ 
          error: 'Email service error',
          details: error.response.body?.errors?.[0]?.message || 'Unknown SendGrid error'
        }) 
      };
    } else {
      // Generic error
      return { 
        statusCode: 500, 
        body: JSON.stringify({ 
          error: 'Failed to send email',
          details: error.message 
        }) 
      };
    }
  }
}