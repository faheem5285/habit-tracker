import { handleRecoveryRequest } from '../recoveryApi.mjs';

export default {
  fetch(request) {
    return handleRecoveryRequest(request);
  },
};
