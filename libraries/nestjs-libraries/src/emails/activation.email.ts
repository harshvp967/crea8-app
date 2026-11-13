export const ACTIVATION_EMAIL_SUBJECT = 'Activate your crea8.one account';

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const activationEmailDocument = `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="x-apple-disable-message-reformatting">
  <title>Activate your crea8.one account</title>
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#0f0e13;width:100%;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="#0f0e13" style="background-color:#0f0e13;width:100%;">
    <tr><td align="center" valign="top" bgcolor="#0f0e13" style="background-color:#0f0e13;padding:32px 16px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" bgcolor="#1a1920" style="width:100%;max-width:600px;">
        <tr><td align="left" bgcolor="#1a1920" style="background-color:#1a1920;padding:40px 40px 16px 40px;">
          <img src="https://app.crea8.one/crea8one-logo.png" alt="crea8.one" width="200" height="60" border="0" style="display:block;width:200px;height:60px;border-width:0;" />
        </td></tr>
        <tr><td align="left" bgcolor="#1a1920" style="background-color:#1a1920;padding:16px 40px 8px 40px;">
          <h1 style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:24px;line-height:1.25;font-weight:700;color:#f5f3ee;">Activate your account</h1>
        </td></tr>
        <tr><td align="left" bgcolor="#1a1920" style="background-color:#1a1920;padding:24px 40px 8px 40px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
            <td align="center" bgcolor="#00d9ff" style="background-color:#00d9ff;border-radius:999px;">
              <!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="{{{ACTIVATION_LINK}}}" style="height:48px;v-text-anchor:middle;width:220px;" arcsize="50%" fillcolor="#00d9ff" stroke="f"><w:anchorlock/><center style="color:#121016;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:bold;">Activate account</center></v:roundrect><![endif]-->
              <!--[if !mso]><!--><a href="{{{ACTIVATION_LINK}}}" style="display:inline-block;padding:14px 28px;background-color:#00d9ff;color:#121016;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1;font-weight:700;text-decoration:none;border-radius:999px;">Activate account</a><!--<![endif]-->
            </td>
          </tr></table>
        </td></tr>
        <tr><td align="left" bgcolor="#1a1920" style="background-color:#1a1920;padding:16px 40px 32px 40px;">
          <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.5;color:#a29fae;word-break:break-all;"><a href="{{{ACTIVATION_LINK}}}" style="color:#00d9ff;text-decoration:underline;">{{{ACTIVATION_LINK}}}</a></p>
        </td></tr>
        <tr><td align="left" bgcolor="#1a1920" style="background-color:#1a1920;border-top:1px solid #2c2a33;padding:20px 40px 32px 40px;">
          <p style="margin:0 0 4px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.4;font-weight:700;color:#f5f3ee;">crea8.one</p>
          <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.4;color:#a29fae;"><a href="mailto:support@crea8.one" style="color:#a29fae;text-decoration:none;">support@crea8.one</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
`;

export function activationEmailHtml(activationLink: string) {
  return activationEmailDocument
    .split('{{{ACTIVATION_LINK}}}')
    .join(escapeHtml(activationLink));
}
