// Define simulation globally
let simulation;

// Event listener for search button
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
      alert(
        "No valid artists found with that name. Please try a different search."
      );
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
      <img src="${artist.cover_image || ""}" alt="${
      artist.title
    }" width="50" height="50" style="border-radius: 0%; margin-right: 10px; object-fit: cover;">
      <div style="flex-grow: 1; font-size: 12px;">${artist.title}</div>
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
    const response = await fetch(
      `http://localhost:4000/artist-details/${artistId}`
    );
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

  console.log("Data passed to createGraph:", data);

  if (!data || !data.artist || !Array.isArray(data.releases)) {
    console.error("Invalid data format for graph rendering.");
    return;
  }

  // Set up the SVG area
  const svg = d3
    .select("#graph")
    .append("svg")
    .attr("width", "100%")
    .attr("height", "100%")
    .append("g")
    .call(
      d3.zoom().on("zoom", (event) => svg.attr("transform", event.transform))
    )
    .append("g");

  const width = document.getElementById("graph").clientWidth;
  const height = document.getElementById("graph").clientHeight;

  const nodes = [
    {
      id: data.artist.id,
      name: data.artist.name,
      type: "artist",
      cover_image: data.artist.cover_image,
    },
  ];
  const links = [];

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

  // Set up the force simulation
  simulation = d3
    .forceSimulation(nodes)
    .force(
      "link",
      d3
        .forceLink(links)
        .id((d) => d.id)
        .distance(250)
    )
    .force("charge", d3.forceManyBody().strength(-600))
    .force("center", d3.forceCenter(width / 2, height / 2))
    .force("collision", d3.forceCollide().radius(80));

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
    .call(
      d3
        .drag()
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
    .style("background", (d) =>
      d.type === "artist" ? "rgba(255, 255, 255, 0.8)" : "none"
    )
    .style("padding", "5px")
    .style("border-radius", (d) => (d.type === "artist" ? "50%" : "10px"))
    .html(
      (d) => `
      <img src="${d.cover_image || "placeholder.jpg"}" width="${
        d.type === "artist" ? 150 : 80
      }" height="${
        d.type === "artist" ? 150 : 80
      }" style="object-fit: cover;"><br>
      <span style="font-size: 10px; text-align: center;">${d.name}</span>
    `
    );

  // Update positions on each simulation tick
  simulation.on("tick", () => {
    link
      .attr("x1", (d) => d.source.x)
      .attr("y1", (d) => d.source.y)
      .attr("x2", (d) => d.target.x)
      .attr("y2", (d) => d.target.y);

    node.attr("transform", (d) => `translate(${d.x},${d.y})`);
  });

  // Event listener for album click to add further connections
  node.on("click", (event, d) => {
    if (d.type === "release") {
      fetchAndDisplayRelatedAlbums(d);
    }
  });
}

async function fetchAndDisplayRelatedAlbums(releaseNode) {
  try {
    const url = `http://localhost:4000/release-details/${releaseNode.id}`;
    console.log(`Fetching related albums with URL: ${url}`);

    // Make a request to fetch related album details including videos
    const response = await fetch(url);

    // Log the raw response to see what is being returned
    const textResponse = await response.text();
    console.log("Raw response text:", textResponse);

    // Check if the response is not ok (e.g., 404 or 500 error)
    if (!response.ok) {
      throw new Error(
        `Server returned ${response.status}: ${response.statusText}`
      );
    }

    // Convert the response back to JSON (after logging it as text)
    const releaseData = JSON.parse(textResponse);

    // If response has a `videos` key, proceed with creating nodes
    if (releaseData && Array.isArray(releaseData.videos)) {
      const nodesToAdd = [];
      const linksToAdd = [];

      // Add nodes for videos related to the release
      releaseData.videos.forEach((video, index) => {
        const videoNodeId = `video-${releaseNode.id}-${index}`;
        nodesToAdd.push({
          id: videoNodeId,
          name: video.title,
          type: "video",
          video_url: video.uri,
          description: video.description,
          duration: video.duration,
        });
        linksToAdd.push({ source: releaseNode.id, target: videoNodeId });
      });

      // Append new nodes and links to the graph
      addNodesAndLinks(nodesToAdd, linksToAdd);
    } else {
      console.error("No videos found in the response.");
    }
  } catch (error) {
    console.error("Error fetching related album details:", error);
    alert("Failed to fetch related album details. Please try again.");
  }
}

function addNodesAndLinks(newNodes, newLinks) {
  const svg = d3.select("#graph svg g");
  const allNodes = d3
    .select("#graph svg g")
    .selectAll(".node")
    .data()
    .concat(newNodes);
  const allLinks = d3
    .select("#graph svg g")
    .selectAll("line")
    .data()
    .concat(newLinks);

  // Update the force simulation with the new nodes and links
  simulation.nodes(allNodes);
  simulation.force("link").links(allLinks);

  // Restart the simulation
  simulation.alpha(1).restart();

  // Append new links
  svg
    .selectAll("line")
    .data(allLinks, (d) => `${d.source.id}-${d.target.id}`) // Key function to prevent duplication
    .enter()
    .append("line")
    .style("stroke", "#aaa");

  // Append new nodes
  const nodeEnter = svg
    .selectAll(".node")
    .data(allNodes, (d) => d.id) // Use id as key to ensure uniqueness
    .enter()
    .append("g")
    .attr("class", "node")
    .call(
      d3
        .drag()
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

  // Add images and labels to new nodes
  nodeEnter
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
    .style("background", (d) =>
      d.type === "artist" ? "rgba(255, 255, 255, 0.8)" : "none"
    )
    .style("padding", "5px")
    .style("border-radius", (d) => (d.type === "artist" ? "50%" : "10px"))
    .html((d) => {
      if (d.type === "video") {
        return `<iframe width="100" height="80" src="${d.video_url}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe><br><span style="font-size: 10px; text-align: center;">${d.name}</span>`;
      } else {
        return `<img src="${d.cover_image || "placeholder.jpg"}" width="${
          d.type === "artist" ? 150 : 80
        }" height="${
          d.type === "artist" ? 150 : 80
        }" style="object-fit: cover;"><br><span style="font-size: 10px; text-align: center;">${
          d.name
        }</span>`;
      }
    });
}
