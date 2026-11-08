import { response } from '../_shared/http.ts'
const env = Deno.env.toObject()
void env
// Native Auth OTP delivery is retired. RKMED sends/verifies its own email codes.
// Session-link redemption happens server-side after RKMED verification only.
Deno.serve(() => response({ error: { http_code: 503, message: 'Utilize o fluxo de verificação RKMED.' } }, 503))
