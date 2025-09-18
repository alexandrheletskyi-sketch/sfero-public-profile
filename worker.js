export default {
async fetch(request, env) {
let res = await env.ASSETS.fetch(request);
if (res.status === 404 && request.method === "GET" && (request.headers.get("accept")||"").includes("text/html")) {
const url = new URL(request.url); url.pathname = "/index.html";
res = await env.ASSETS.fetch(new Request(url, request));
}
return res;
},
}