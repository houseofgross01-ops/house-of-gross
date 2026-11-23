HOGS / HOUSE OF GROSS: WEBSITE (v10)

Upload the whole folder to any static host (Netlify, Vercel, Cloudflare Pages, Hostinger,
cPanel). No install, no build step, no external services: fonts, images, videos and all
animation code are inside this folder. You can also open index.html straight from your
computer to preview it.

PAGES
  index.html       Home
  work.html        Photography archive (filter + full-screen viewer) and clients
                   work.html?f=Fashion or work.html?f=Live opens a filtered view
  about.html       The house
  expertise.html   Strategy, Creative, Storytelling
  people.html      The team
  contact.html     The brief (opens the visitor's email app; nothing is sent to a server)
  about/, work/, expertise/, people/, contact/   Redirects so old links keep working

FILES
  assets/hogs.css             All styles (design tokens at the top under :root)
  assets/hogs.js              All motion and interaction (no libraries)
  assets/fonts/               Geist, Geist Mono, Bodoni Moda Italic, Titan One (self-hosted)
  assets/img/                 Optimised WebP photos and the chrome 3D icons (chrome-*.webp)
  assets/video/hogs-reel.mp4  20-second loop cut from HOGS photos (hero pill, About story)
  assets/video/hogs-atmos.mp4 Blurred atmosphere loop behind the home-page ring
  assets/og/                  1200x630 share images
  work/*.jpg                  Original photos

TWO LIGHTS
  Every section is marked data-theme="light" or "dark". As you scroll, the page fades
  between paper (#f2efe9) and night (#0b0a0a) to match the section in the middle of the
  screen. The navigation glass and logo switch with it.

MOTION HIGHLIGHTS
  Every load and page change: a red scribble draws over the screen and unwinds.
  Hover ink (every big headline): the pointer paints red ink over the words; inside the ink the
    same words appear as inflated 3D letters in a new material each stroke (chrome, pink and
    blue balloon, lime, gold, purple chrome, red lacquer). Drips fall and it dries away.
    Phones get a painted stroke when a headline comes into view, or when you tap it.
  Home: H, the logo's own infinity-g loop, S. The loop draws itself and plays the reel
    inside it, over flowing red lines. Scroll and the camera dives through the crossing of
    the infinity into the full reel: "Made to move culture." Then the story: cards rise in, fan, scatter, pile and wheel; one card
    grows into a red room where the chrome HOGS loop rises; the camera dives through it into
    a deep red room where the manifesto writes itself word by word. Then
    Latest drops (a 3D stack that peels away), gross / perfection, and clients.
  The house: the ring. A sentence you can point at (each choice previews its work) and
    frames that form a ring around you; scroll, drag or tab to turn it. Then the three
    disciplines as expanding photo panels.
  Work: the archive with filters and a full-screen viewer, then Good company, a wall of
    client names by world.
  People: "Meet the crew", photos rise past the title (Yash Raj, then Yash Verma); flick
    them with the mouse.
  Work, Expertise, People headers: a photo card rests beside the title; pick it up with the
    cursor and it changes photo as you move.
  Footer and contact page: one big question at a time (idea, budget in rupees, email). The
    field types example answers until you click in, over a curved strip of chrome icons.

CHANGING THINGS
  Colours and type sizes: edit the variables at the top of assets/hogs.css.
  Text: edit the HTML files directly.
  Adding a photo: export WebP at 480px and full width into assets/img, then copy an
  existing <li class="wk__item"> block in work.html and add a matching entry to the JSON in
  <script id="wk-data"> at the bottom of work.html.

NOTES
  The brief opens the visitor's email app with everything filled in; nothing is sent to a
  server, so no backend is needed.
  "Reduce motion" in device settings gives a calm, static version of every page. Anyone can
  press "Pause motion" in the footer.
  The liquid-glass refraction on the navigation uses an effect only Chromium browsers
  support (Chrome, Edge, Samsung Internet, Android). Safari and Firefox show frosted glass.
  Before launch, replace the temporary domain in each page's <link rel="canonical"> and og:
  tags, and in sitemap.xml and robots.txt, with your real domain.
