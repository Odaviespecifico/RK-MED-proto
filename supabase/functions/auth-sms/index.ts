import { response } from '../_shared/http.ts'
const env = Deno.env.toObject()
void env
// Native phone OTP delivery is retired; RKMED owns codes and SMS Dev transports them.
Deno.serve(() => response({ error: { http_code: 503, message: 'Utilize o fluxo de verificação RKMED.' } }, 503))
