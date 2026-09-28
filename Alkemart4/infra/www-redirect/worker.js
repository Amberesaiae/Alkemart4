export default {
  fetch(request) {
    const target = new URL(request.url);
    if (target.hostname !== 'www.alkemart.com') {
      return new Response('Not found', { status: 404 });
    }
    target.protocol = 'https:';
    target.hostname = 'alkemart.com';
    target.port = '';
    return Response.redirect(target.toString(), 308);
  },
};
