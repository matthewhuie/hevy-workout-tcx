(function() {
    const HEVY_URL = 'https://api.hevyapp.com/workout/';

    // 1. Intercept Fetch Requests
    const originalFetch = window.fetch;
    window.fetch = async function(...args) {
	const url = args[0] ? args[0].toString() : '';
        const response = await originalFetch.apply(this, args);
        
	if (url.startsWith(HEVY_URL)) {
          const clone = response.clone();

          clone.json().then(data => {
              if (data && data.biometrics && data.exercises) {
                  window.postMessage({ type: 'HEVY_WORKOUT_DATA_FOUND', payload: data }, '*');
              }
          }).catch(() => {});
        }

        return response;
    };

    // 2. Intercept XMLHttpRequest
    const XHR = XMLHttpRequest.prototype;
    const open = XHR.open;
    const send = XHR.send;

    XHR.open = function(method, url) {
        this._method = method;
        this._url = url;
        return open.apply(this, arguments);
    };

    XHR.send = function(postData) {
        this.addEventListener('load', function() {
	    if (this._url && this._url.startsWith(HEVY_URL)) {
                try {
                    const data = JSON.parse(this.responseText);
                    if (data && data.biometrics && data.exercises) {
                        window.postMessage({ type: 'HEVY_WORKOUT_DATA_FOUND', payload: data }, '*');
                    }
                } catch (err) {}
	    }
        });

        return send.apply(this, arguments);
    };
})();
