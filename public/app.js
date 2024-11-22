// Front-end code (app.js) to interact with the server and render artist, albums, and tracks

document.getElementById("search-btn").addEventListener("click", async () => {
  const artistName = document.getElementById("artist-input").value.trim();

  if (!artistName) {
    alert("Please enter an artist name.");
    return;
  }

  try {
    // Make a request to the server
    const response = await fetch(`http://localhost:4000/artist/${artistName}`);
    const artists = await response.json();

    if (!Array.isArray(artists) || artists.length === 0) {
      alert("No valid artists found with that name. Please try a different search.");
      return;
    }

    // Show artist options for user selection
    displayArtistOptions(artists);
  } catch (error) {
    console.error("Error fetching artist data:", error);
    alert("Failed to fetch artist data.");
  }
});

function displayArtistOptions(artists) {
  const selectionContainer = document.getElementById("artist-list-panel");
  if (!selectionContainer) {
    console.error("Artist panel element not found.");
    return;
  }
  selectionContainer.innerHTML = ""; // Clear previous options

  artists.forEach((artist) => {
    const artistButton = document.createElement("div");
    artistButton.classList.add("artist-option");
    artistButton.style.display = "flex";
    artistButton.style.alignItems = "center";
    artistButton.style.padding = "5px";
    artistButton.style.borderBottom = "1px solid #ccc";
    artistButton.style.cursor = "pointer";

    artistButton.innerHTML = `
      <img src="${artist.cover_image || ''}" alt="${artist.title}" width="50" height="50" style="margin-right: 10px; object-fit: cover;">
      <div style="flex-grow: 1; font-size: 14px; ;">${artist.title}</div>
    `;

    artistButton.addEventListener("click", () => {
      // Display the selected artist and keep the artist list visible on the side panel
      fetchAndVisualizeArtist(artist.id);
    });
    selectionContainer.appendChild(artistButton);
  });
}

async function fetchAndVisualizeArtist(artistId) {
  try {
    // Make a request to the server for artist details
    const response = await fetch(`http://localhost:4000/artist-details/${artistId}`);
    const data = await response.json();

    // Use the fetched data to render the graph
    createGraph(data);
  } catch (error) {
    console.error("Error fetching artist details:", error);
    alert("Failed to fetch artist details.");
  }
}

function createGraph(data) {
  // Clear any existing content
  d3.select("#graph").selectAll("*").remove();

  // Check if data is correctly passed in
  console.log("Data passed to createGraph:", data);

  if (!data || !data.artist || !Array.isArray(data.releases)) {
    console.error("Invalid data format for graph rendering.");
    return;
  }

  // Set up the SVG area
  const svg = d3.select("#graph")
    .append("svg")
    .attr("width", "100%")
    .attr("height", "100%")
    .append("g")
    .call(d3.zoom().on("zoom", (event) => svg.attr("transform", event.transform)))  // Add zoom functionality
    .append("g");

  const width = document.getElementById("graph").clientWidth;
  const height = document.getElementById("graph").clientHeight;

  // Create nodes and links for D3.js
  const nodes = [
    {
      id: data.artist.id,
      name: data.artist.name,
      type: "artist",
      cover_image: data.artist.cover_image,
    },
  ];
  const links = [];

  // Add releases directly under the artist node
  data.releases.forEach((release, releaseIndex) => {
    const releaseNodeId = `release-${releaseIndex}`;
    nodes.push({
      id: releaseNodeId,
      name: release.title,
      type: "release",
      cover_image: release.cover_image,
      year: release.year,
      label: release.label,
    });
    links.push({ source: data.artist.id, target: releaseNodeId });
  });

  console.log("Nodes after parsing:", nodes);
  console.log("Links after parsing:", links);

  // Ensure nodes and links have been properly constructed
  if (nodes.length === 0 || links.length === 0) {
    console.error("No nodes or links available to render.");
    return;
  }

  // Set up the force simulation
  const simulation = d3
    .forceSimulation(nodes)
    .force("link", d3.forceLink(links).id((d) => d.id).distance(250)) // Increase link distance for more spacing
    .force("charge", d3.forceManyBody().strength(-600)) // Increase repulsion for more spacing between nodes
    .force("center", d3.forceCenter(width / 2, height / 2))
    .force("collision", d3.forceCollide().radius(80)); // Increase collision radius for better separation

  // Create links (lines)
  const link = svg
    .selectAll("line")
    .data(links)
    .enter()
    .append("line")
    .style("stroke", "#aaa");

  // Create nodes (circles or images)
  const node = svg
    .selectAll(".node")
    .data(nodes)
    .enter()
    .append("g")
    .attr("class", "node")
    .call(d3.drag() // Make nodes draggable
      .on("start", (event, d) => {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on("drag", (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on("end", (event, d) => {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      })
    );

  // Append images and labels in the same container to nodes if available
  node
    .append("foreignObject")
    .attr("x", -60)
    .attr("y", -60)
    .attr("width", 120)
    .attr("height", 140)
    .append("xhtml:div")
    .style("display", "flex")
    .style("flex-direction", "column")
    .style("align-items", "center")
    .style("justify-content", "center")
    .style("background", (d) => d.type === "artist" ? "rgba(255, 255, 255, 0.8)" : "none")
    .style("padding", "5px") // Decrease padding for better spacing
    .style("border-radius", (d) => d.type === "artist" ? "0%" : "14px")
    .html((d) => `
      <img src="${d.cover_image}" width="${d.type === "artist" ? 100 : 80}" height="${d.type === "artist" ? 100 : 80}" style="object-fit: cover;"><br>
      <span style="font-size: 14px; text-align: center;">${d.name}</span>
    `);

  // Update positions on each simulation tick
  simulation.on("tick", () => {
    link
      .attr("x1", (d) => d.source.x)
      .attr("y1", (d) => d.source.y)
      .attr("x2", (d) => d.target.x)
      .attr("y2", (d) => d.target.y);

    node.attr("transform", (d) => `translate(${d.x},${d.y})`);
  });

  // Add zoom and pan functionality for the entire canvas
  d3.select("svg")
    .call(d3.zoom()
      .scaleExtent([0.5, 5])
      .on("zoom", (event) => {
        svg.attr("transform", event.transform);
      }));
}
