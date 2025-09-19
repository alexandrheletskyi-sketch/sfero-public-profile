export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Логіка для обробки POST-запитів (бронювання)
    if (request.method === 'POST') {
      try {
        const formData = await request.formData();
        const bookingData = {
          profile_id: formData.get('profile_id'),
          service_id: formData.get('service_id'),
          client_name: formData.get('client_name'),
          client_email: formData.get('client_email'),
          client_phone: formData.get('client_phone'),
          time_slot: formData.get('time_slot'),
        };

        const supabaseUrl = env.SUPABASE_URL;
        const supabaseKey = env.SUPABASE_ANON_KEY;
        const base44ApiKey = env.BASE44_API_KEY;
        const base44AppId = env.BASE44_APP_ID;

        const supabaseResponse = await fetch(`${supabaseUrl}/rest/v1/bookings`, {
          method: 'POST',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify(bookingData)
        });

        if (!supabaseResponse.ok) {
          const errorText = await supabaseResponse.text();
          return new Response(`Помилка бронювання в Supabase: ${supabaseResponse.status} ${errorText}`, { status: 500 });
        }

        const base44Response = await fetch(`https://app.base44.com/api/apps/${base44AppId}/entities/Booking`, {
          method: 'POST',
          headers: {
            'api_key': base44ApiKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(bookingData)
        });

        if (!base44Response.ok) {
           const errorText = await base44Response.text();
        }

        return new Response('Бронювання успішно підтверджено і синхронізовано!', { status: 200 });
      } catch (err) {
        return new Response(`Помилка сервера: ${err.message}`, { status: 500 });
      }
    }

    // Логіка для обробки GET-запитів до API
    if (url.pathname === '/api/profile') {
      const slug = url.searchParams.get('slug')?.toLowerCase();
      if (!slug) {
        return new Response('Slug not provided', { status: 400 });
      }

      const supabaseUrl = env.SUPABASE_URL;
      const supabaseKey = env.SUPABASE_ANON_KEY;
      
      try {
        const profileResp = await fetch(`${supabaseUrl}/rest/v1/profiles?slug=eq.${encodeURIComponent(slug)}&select=*`, {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json'
          }
        });

        const profiles = await profileResp.json();
        const profile = profiles[0];

        if (!profile) {
          return new Response('Профіль не знайдено', { status: 404 });
        }
        
        const servicesResp = await fetch(`${supabaseUrl}/rest/v1/services?profile_id=eq.${profile.id}&select=*`, {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json'
          }
        });
        
        let services = [];
        if (servicesResp.ok) {
          services = await servicesResp.json();
        }
        
        // --- НОВА ЛОГІКА ДЛЯ ПЕРЕГЛЯДІВ ---
        const pageViews = await env.STATS.get(slug);
        const viewCount = pageViews ? parseInt(pageViews) : 0;
        
        return new Response(JSON.stringify({ profile, services, viewCount }), {
          headers: { 'Content-Type': 'application/json' }
        });

      } catch (err) {
        return new Response(`Помилка сервера: ${err.message}`, { status: 500 });
      }
    }

    // Логіка для обслуговування статичних файлів з репозиторію
    const githubUrl = 'https://raw.githubusercontent.com/alexandrheletskyi-sketch/sfero-public-profile/main/spa';
    let assetPath = url.pathname;

    // Якщо це запит до кореневого каталогу або шляху профілю, повертаємо index.html
    if (assetPath === '/' || assetPath.startsWith('/profile')) {
      assetPath = '/index.html';
      
      // --- НОВА ЛОГІКА ДЛЯ ПЕРЕГЛЯДІВ ---
      const slug = url.searchParams.get('slug')?.toLowerCase();
      if (slug) {
        const pageViews = await env.STATS.get(slug);
        const viewCount = pageViews ? parseInt(pageViews) : 0;
        await env.STATS.put(slug, (viewCount + 1).toString());
      }
    }

    const assetUrl = new URL(`${githubUrl}${assetPath}`);
    const response = await fetch(assetUrl);

    if (response.ok) {
        const headers = { 'Content-Type': 'text/plain' };
        if (assetPath.endsWith('.html')) {
            headers['Content-Type'] = 'text/html';
        } else {
            const contentType = response.headers.get('Content-Type');
            if (contentType) {
                headers['Content-Type'] = contentType;
            }
        }

        return new Response(response.body, { headers });
    } else {
        return new Response('Not Found', { status: 404 });
    }
  }
};