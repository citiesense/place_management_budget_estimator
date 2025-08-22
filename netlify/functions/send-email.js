// netlify/functions/send-email.js
// Email sending function using nodemailer with SMTP configuration
// Follows the same pattern as citiesense_search application

import nodemailer from 'nodemailer';

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { emails, reportData, pdfData } = body;

    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing or invalid email addresses' }) };
    }

    if (!reportData || !pdfData) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing report data or PDF data' }) };
    }

    // Validate required environment variables
    const requiredEnvVars = [
      'EMAIL_SERVER_ADDRESS',
      'EMAIL_SERVER_USERNAME', 
      'EMAIL_SERVER_PASSWORD',
      'EMAIL_SERVER_DOMAIN'
    ];

    for (const envVar of requiredEnvVars) {
      if (!process.env[envVar]) {
        return { 
          statusCode: 500, 
          body: JSON.stringify({ error: `Missing environment variable: ${envVar}` }) 
        };
      }
    }

    // Create SMTP transporter using same config as citiesense_search
    const transporter = nodemailer.createTransporter({
      host: process.env.EMAIL_SERVER_ADDRESS,
      port: 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.EMAIL_SERVER_USERNAME,
        pass: process.env.EMAIL_SERVER_PASSWORD,
      },
      tls: {
        rejectUnauthorized: false // Allow self-signed certificates
      }
    });

    // Verify SMTP connection
    await transporter.verify();

    // Prepare email content
    const subject = `BID Budget Analysis Report - ${reportData.placeTypology}`;
    
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #0ea5e9, #059669); color: white; padding: 30px 20px; border-radius: 8px; text-align: center; margin-bottom: 30px; }
          .header h1 { margin: 0; font-size: 24px; }
          .summary { background: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
          .metric { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e2e8f0; }
          .metric:last-child { border-bottom: none; }
          .metric strong { color: #1e293b; }
          .footer { text-align: center; color: #64748b; font-size: 14px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; }
          .cta { background: #0ea5e9; color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🏙️ BID Budget Analysis Report</h1>
          <p>Professional budget estimation for your district</p>
        </div>
        
        <p>Hello,</p>
        
        <p>Please find attached the comprehensive BID (Business Improvement District) budget analysis report for your review. This report contains detailed calculations and recommendations based on industry standards.</p>
        
        <div class="summary">
          <h3 style="margin-top: 0; color: #059669;">📊 Report Summary</h3>
          <div class="metric">
            <span><strong>District Type:</strong></span>
            <span>${reportData.placeTypology}</span>
          </div>
          <div class="metric">
            <span><strong>Total Businesses:</strong></span>
            <span>${reportData.totalPlaces.toLocaleString()}</span>
          </div>
          <div class="metric">
            <span><strong>Coverage Area:</strong></span>
            <span>${reportData.areaAcres} acres</span>
          </div>
          <div class="metric">
            <span><strong>Annual Budget Estimate:</strong></span>
            <span><strong style="color: #0ea5e9;">$${reportData.totalBudget.toLocaleString()}</strong></span>
          </div>
        </div>
        
        <h3>📋 What's Included in the Report:</h3>
        <ul>
          <li><strong>Executive Summary:</strong> Key metrics and budget breakdown</li>
          <li><strong>Service Details:</strong> Cleaning, safety, marketing, and streetscape analysis</li>
          <li><strong>Staffing Estimates:</strong> FTE requirements and coverage recommendations</li>
          <li><strong>Priority Services:</strong> Data-driven recommendations based on business mix</li>
          <li><strong>Methodology:</strong> Industry-standard calculation explanations</li>
        </ul>
        
        <p>The attached PDF contains all details including budget allocations, service intensity calculations, and actionable recommendations for your board presentation.</p>
        
        <div class="footer">
          <p><strong>Generated by BID Budget Estimator</strong><br>
          Professional budget analysis tool powered by Overture Maps data<br>
          <em>Report generated on ${new Date().toLocaleDateString()}</em></p>
        </div>
      </body>
      </html>
    `;

    const textContent = `
BID Budget Analysis Report - ${reportData.placeTypology}

Hello,

Please find attached the comprehensive BID budget analysis report for your review.

Report Summary:
• District Type: ${reportData.placeTypology}
• Total Businesses: ${reportData.totalPlaces.toLocaleString()}
• Coverage Area: ${reportData.areaAcres} acres
• Annual Budget Estimate: $${reportData.totalBudget.toLocaleString()}

The attached PDF contains detailed budget breakdowns, service recommendations, and industry-standard calculations.

Generated by BID Budget Estimator
Report generated on ${new Date().toLocaleDateString()}
    `;

    // Send email to each recipient
    const emailPromises = emails.map(async (email) => {
      const mailOptions = {
        from: `"BID Budget Estimator" <${process.env.EMAIL_SERVER_USERNAME}>`,
        to: email.trim(),
        subject: subject,
        text: textContent,
        html: htmlContent,
        attachments: [
          {
            filename: `BID-Budget-Report-${new Date().toISOString().split('T')[0]}.pdf`,
            content: pdfData,
            encoding: 'base64',
            contentType: 'application/pdf'
          }
        ]
      };

      return transporter.sendMail(mailOptions);
    });

    // Wait for all emails to be sent
    await Promise.all(emailPromises);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        success: true, 
        message: `Report successfully sent to ${emails.length} recipient${emails.length > 1 ? 's' : ''}` 
      })
    };

  } catch (error) {
    console.error('Email sending error:', error);
    
    // Return appropriate error message
    if (error.code === 'EAUTH') {
      return { 
        statusCode: 500, 
        body: JSON.stringify({ error: 'Email authentication failed. Please check SMTP credentials.' }) 
      };
    } else if (error.code === 'ECONNECTION') {
      return { 
        statusCode: 500, 
        body: JSON.stringify({ error: 'Failed to connect to email server. Please check SMTP settings.' }) 
      };
    } else {
      return { 
        statusCode: 500, 
        body: JSON.stringify({ error: `Failed to send email: ${error.message}` }) 
      };
    }
  }
}