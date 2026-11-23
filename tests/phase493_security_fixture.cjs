'use strict';
// Synthetic policy fixture ONLY. Not production authentication code.
// Real verification must use Admin SDK checkRevoked=true and independently audited server authorization.
function authorize({token,ownerId,now}) {
  return Boolean(token && token.signatureValid === true && token.revoked === false &&
    Number.isFinite(token.expiresAt) && token.expiresAt > now &&
    typeof ownerId === 'string' && token.uid === ownerId);
}
module.exports = {authorize};
