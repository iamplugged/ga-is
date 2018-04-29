var getMessages = (function() {
  const defaultHeaders = {
    Accept: "application/json",
    "Content-Type": "application/json"
  };

  const BASE_URL = "http://message-list.appspot.com/";

  const parseJSON = (response) => response.json();

  const fetchAPI = (url) => {
    return fetch(url)
    .then(parseJSON)
    .then(data => (data))
    .catch((e) => {
      throw new Error("API Connection issue");
    });
  };

  const fetchMessagesApi = (count, pageToken) => {
    const options = {
      method: "GET",
      headers: defaultHeaders
    };

    let queryStr = `limit=${count}`;
    if (pageToken) {
      queryStr += `&pageToken=${pageToken}`
    }
    return fetchAPI(`${BASE_URL}/messages?${queryStr}`, options);
  };

  return fetchMessagesApi;
})();
