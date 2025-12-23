import * as argon2 from 'argon2';

type FnResult<T> =
  | { status: true; data: T; error: null }
  | { status: false; data: null; error: string };

export async function hashString(password: string): Promise<FnResult<string>> {
  try {
    const hash = await argon2.hash(password, {
      timeCost: 4,
      hashLength: 32,
      memoryCost: 65536,
      type: argon2.argon2id,
    });

    return { status: true, data: hash, error: null };
  } catch (error: unknown) {
    //FIXME: USE A BETTER LOGGER
    console.log(error);

    if (error instanceof Error) {
      return { status: false, data: null, error: error.message };
    }

    return { status: false, data: null, error: 'Failed to hash password' };
  }
}

export async function compareHashedString({
  plainString,
  hash,
}: {
  plainString: string;
  hash: string;
}) {
  try {
    const isTheSame = await argon2.verify(hash, plainString);

    return { status: true, data: isTheSame, error: null };
  } catch (error: unknown) {
    //FIXME: USE A BETTER LOGGER
    console.log(error);

    if (error instanceof Error) {
      return { status: false, data: null, error: error.message };
    }

    return { status: false, data: null, error: 'Failed to hash password' };
  }
}

export function makeBlacklistedKey(key: string) {
  return `blacklisted:${key}`;
}

export function generateSuspiciousLoginMail(ipAddr: string) {
  const temp = `<!DOCTYPE html>
<html>
<head>
    <style>
        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
        }
        .header {
            color: #d32f2f;
            border-bottom: 2px solid #f5f5f5;
            padding-bottom: 10px;
            margin-bottom: 20px;
        }
        .content {
            background-color: #f9f9f9;
            padding: 20px;
            border-radius: 5px;
            margin: 20px 0;
        }
        .warning {
            color: #d32f2f;
            font-weight: bold;
        }
        .footer {
            margin-top: 30px;
            font-size: 12px;
            color: #777;
            border-top: 1px solid #eee;
            padding-top: 10px;
        }
    </style>
</head>
<body>
    <div class="header">
        <h2>Security Alert: Suspicious Login Attempt</h2>
    </div>
    
    <div class="content">
        <p>Hello,</p>
        
        <p>We noticed multiple failed login attempts to your account from the following IP address:</p>
        
        <p class="warning">IP Address: ${ipAddr}</p>
        
        <p>If this was you, you can ignore this email. Your account remains secure, but you may want to consider changing your password if you're having trouble logging in.</p>
        
        <p>If you don't recognize this activity, we strongly recommend that you:</p>
        <ol>
            <li>Change your password immediately</li>
            <li>Enable two-factor authentication if available</li>
            <li>Contact our support team if you need assistance</li>
        </ol>
        
        <p>For security reasons, your account will be temporarily locked after 5 failed login attempts.</p>
    </div>
    
    <div class="footer">
        <p>This is an automated message. Please do not reply to this email.</p>
        <p>&copy; ${new Date().getFullYear()} Org Rel. All rights reserved.</p>
    </div>
</body>
</html>`;

  return temp;
}
