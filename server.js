// Server code to handle the music graph API functionality without OAuth authentication

const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const path = require('path');
const app = express();
const PORT = 4000;
const DISCOGS_TOKEN = 'WRQzxgIrvOdFYwxTMPARVMugvuTcNgvhcTCpNDTf';

app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// Root endpoint
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Endpoint to search for an artist by name
app.get('/artist/:name', async (req, res) => {
    const artistName = req.params.name;
    const url = `https://api.discogs.com/database/search?q=${encodeURIComponent(artistName)}&type=artist&token=${DISCOGS_TOKEN}`;

    try {
        const response = await fetch(url);
        const data = await response.json();
        const artists = data.results.filter((result) => result.type === 'artist');
        res.json(artists);
    } catch (error) {
        console.error('Error fetching artist:', error);
        res.status(500).json({ error: 'Failed to fetch artist data' });
    }
});

// Endpoint to get detailed artist information
app.get('/artist-details/:id', async (req, res) => {
    const artistId = req.params.id;
    const url = `https://api.discogs.com/artists/${artistId}?token=${DISCOGS_TOKEN}`;

    try {
        const response = await fetch(url);
        const artistData = await response.json();

        // Fetch artist releases
        const releasesUrl = `${artistData.releases_url}?sort=year&sort_order=desc&token=${DISCOGS_TOKEN}`;
        const releasesResponse = await fetch(releasesUrl);
        const releasesData = await releasesResponse.json();

        const detailedData = {
            artist: {
                id: artistData.id,
                name: artistData.name,
                profile: artistData.profile,
                cover_image: artistData.images ? artistData.images[0].resource_url : '',
            },
            releases: releasesData.releases.map((release) => ({
                id: release.id,
                title: release.title,
                year: release.year,
                label: release.label,
                genres: release.genre || [],
                cover_image: release.thumb,
            })),
        };

        res.json(detailedData);
    } catch (error) {
        console.error('Error fetching artist details:', error);
        res.status(500).json({ error: 'Failed to fetch artist details' });
    }
});

// Endpoint to get detailed release information
app.get('/artist-details/:artistId', async (req, res) => {
    const artistId = req.params.artistId;
  
    try {
      // Fetch artist data from Discogs API
      const artistResponse = await fetch(`https://api.discogs.com/artists/${artistId}`);
      const artistData = await artistResponse.json();
  
      // Log the entire response to see if we are receiving data
      console.log("Fetched artist data:", artistData);
  
      if (!artistData.id) {
        return res.status(404).json({ error: "Artist not found." });
      }
  
      // Fetch releases from the releases URL provided in artist data
      const releasesResponse = await fetch(artistData.releases_url);
      const releasesData = await releasesResponse.json();
  
      // Log the entire releases response to verify its contents
      console.log("Fetched releases data:", releasesData);
  
      // If no releases are found, handle appropriately
      if (!releasesData.releases || !Array.isArray(releasesData.releases)) {
        console.log("No releases found for artist");
        return res.status(404).json({ error: "No releases found for this artist." });
      }
  
      // Send a response with artist details and releases to the front end
      res.json({
        artist: {
          id: artistData.id,
          name: artistData.name,
          profile_pic: artistData.images && artistData.images.length ? artistData.images[0].uri : "",
        },
        releases: releasesData.releases.map((release) => ({
          id: release.id,
          title: release.title,
          genres: release.genre || [],
          cover_image: release.thumb || "",
        })),
      });
    } catch (error) {
      console.error("Error fetching artist details from Discogs:", error);
      res.status(500).json({ error: "Failed to fetch artist details." });
    }
  });
  

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
