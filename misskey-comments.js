const styles = `
:root {
  --font-color: #e0e0e0; /* Bright text */
  --font-size: 1.0rem;

  --main-background: #1e1e1e; /* Dark main background */
  --block-border-width: 1px;
  --block-border-radius: 5px;
  --block-border-color: #333333; /* Light dark border */
  --block-background-color: #282828; /* Comment background slightly lighter than main */

  --comment-indent: 40px;
}

/* Apply the dark main background to the container element */
misskey-comments {
  font-size: var(--font-size);
  color: var(--font-color);
  background-color: var(--main-background);
  padding: 15px; 
}

p {
  margin: 0 0 1rem 0;
  color: var(--font-color);
}

a {
  color: #6a9fb5; /* Readable link color */
}

#misskey-stats {
  text-align: center;
  font-size: calc(var(--font-size) * 1.5);
}

#misskey-title {
  font-size: calc(var(--font-size) * 1.5);
  font-weight: bold;
  color: #f0f0f0; 
}

#misskey-comments-list {
  margin: 0 auto;
  padding: 0;
}

#misskey-comments-list ul {
  padding-left: var(--comment-indent);
}

#misskey-comments-list li {
  list-style: none;
}

.misskey-comment {
  background-color: var(--block-background-color);
  border-radius: var(--block-border-radius);
  border: var(--block-border-width) var(--block-border-color) solid;
  padding: 15px;
  margin-bottom: 1.5rem;
  display: flex;
  flex-direction: column;
  color: var(--font-color);
}

.misskey-comment p {
  margin-bottom: 0px;
}

.misskey-comment .author {
  padding-top:0;
  display:flex;
}

.misskey-comment .author a {
  text-decoration: none;
  color: var(--font-color); 
}

.misskey-comment .author .avatar img {
  margin-right:1rem;
  min-width:60px;
  border-radius: 5px;
}

.misskey-comment .author .details {
  display: flex;
  flex-direction: column;
  line-height: 1.2em;
}

.misskey-comment .author .details .name {
  font-weight: bold;
  color: #ffffff; 
}

.misskey-comment .author .details .user {
  color: #aaaaaa; 
  font-size: medium;
}

.misskey-comment .author .details a {
    color: inherit; 
}

.misskey-comment .author .date {
  margin-left: auto;
  font-size: small;
  color: #888888; 
}

.misskey-comment .content {
  margin: 15px 0;
  line-height: 1.5em;
  color: var(--font-color);
}

.misskey-comment .author .details a,
.misskey-comment .content p {
  margin-bottom: 10px;
}

.misskey-comment .attachments {
  margin: 0px 10px;
}

.misskey-comment .attachments > * {
  margin: 0px 10px;
}

.misskey-comment .attachments img {
  max-width: 100%;
}

.misskey-comment .status > div, #misskey-stats > div {
  display: inline-block;
  margin-right: 15px;
}

.misskey-comment .status a, #misskey-stats a {
  color: #888888; 
  text-decoration: none;
}

.misskey-comment .status .replies.active a, #misskey-stats .replies.active a {
  color: #61b1ff; 
}

.misskey-comment .status .reblogs.active a, #misskey-stats .reblogs.active a {
  color: #b28cff; 
}

.misskey-comment .status .favourites.active a, #misskey-stats .favourites.active a {
  color: #ffc461; 
}

#error {
    color: #ff6161; 
}
`;

class MisskeyComments extends HTMLElement {
  constructor() {
    super();

    this.host = this.getAttribute("host");
    this.user = this.getAttribute("user");
    this.noteId = this.getAttribute("noteId"); 

    this.commentsLoaded = false;

    const styleElem = document.createElement("style");
    styleElem.innerHTML = styles;
    document.head.appendChild(styleElem);
  }

  connectedCallback() {
    this.innerHTML = `
      <div id="misskey-stats"></div>
      <div id="misskey-title">Comments</div>

      <noscript>
        <div id="error">
          Please enable JavaScript to view the comments powered by the Fediverse.
        </div>
      </noscript>

      <p>You can use your Fediverse account (e.g., Misskey, Mastodon) to reply to this <a class="link"
          href="https://${this.host}/notes/${this.noteId}" rel="ugc">post</a>.
      </p>
      <ul id="misskey-comments-list"></ul>
    `;

    const comments = document.getElementById("misskey-comments-list");
    const rootStyle = this.getAttribute("style");
    if (rootStyle) {
      comments.setAttribute("style", rootStyle);
    }
    this.respondToVisibility(comments, this.loadComments.bind(this));
  }

  escapeHtml(unsafe) {
    return (unsafe || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // --- Misskey specific functions (Adapting Mastodon's logic) ---

  note_active(note, what) {
    if (what === "replies") return note.repliesCount > 0 ? "active" : "";
    if (what === "reblogs") return note.renoteCount > 0 ? "active" : "";
    
    // For reactions, check if the reactions object has any entries
    if (what === "favourites" && note.reactions) {
        return Object.keys(note.reactions).length > 0 ? "active" : "";
    }
    return "";
  }

  note_count(note, what) {
    if (what === "replies") return note.repliesCount || "";
    if (what === "reblogs") return note.renoteCount || "";
    
    // For reactions, sum up all unique reaction counts
    if (what === "favourites" && note.reactions) {
        let totalReactions = 0;
        for (const key in note.reactions) {
            totalReactions += note.reactions[key];
        }
        return totalReactions > 0 ? totalReactions : "";
    }
    return "";
  }

  note_stats(note) {
    const noteUrl = `https://${this.host}/notes/${note.id}`;
    return `
      <div class="replies ${this.note_active(note, "replies")}">
        <a href="${
          noteUrl
        }" rel="ugc nofollow"><i class="fa fa-reply fa-fw"></i>${this.note_count(
          note,
          "replies",
        )}</a>
      </div>
      <div class="reblogs ${this.note_active(note, "reblogs")}">
        <a href="${
          noteUrl
        }" rel="nofollow"><i class="fa fa-retweet fa-fw"></i>${this.note_count(
          note,
          "reblogs",
        )}</a>
      </div>
      <div class="favourites ${this.note_active(note, "favourites")}">
        <a href="${
          noteUrl
        }" rel="nofollow"><i class="fa fa-star fa-fw"></i>${this.note_count(
          note,
          "favourites",
        )}</a>
      </div>
    `;
  }

  user_account(user) {
    // Misskey provides username and host
    return `@${user.username}${user.host ? '@' + user.host : ''}`;
  }

  render_notes(notes, in_reply_to_id) {
    // Misskey uses 'replyId'
    var notesToRender = notes
      .filter((note) => note.replyId === in_reply_to_id)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      
    notesToRender.forEach((note) => this.render_note(notes, note));
  }

  render_note(notes, note) {
    const user = note.user;
    
    // Misskey uses 'text' for content
    const content = note.text || ""; 
    
    // Misskey uses 'files' for attachments
    const attachmentsHtml = (note.files || [])
      .map((attachment) => {
        if (attachment.type.startsWith("image/")) {
            return `<a href="${attachment.url}" rel="ugc nofollow"><img src="${
                attachment.url
            }" alt="${this.escapeHtml(attachment.name)}" loading="lazy" /></a>`;
        } else if (attachment.type.startsWith("video/")) {
            return `<video controls preload="none"><source src="${attachment.url}" type="${attachment.type}"></video>`;
        } else if (attachment.type.startsWith("audio/")) {
            return `<audio controls><source src="${attachment.url}" type="${attachment.type}"></audio>`;
        } else {
            return `<a href="${attachment.url}" rel="ugc nofollow">${attachment.name}</a>`;
        }
      })
      .join("");


    const formatDate = (dateString) => {
      // Misskey uses createdAt. Assuming the format logic is the same.
      return new Date(dateString).toLocaleString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        formatMatcher: 'basic'
      }).replace(',', '').replace(/(\d+)\/(\d+)\/(\d+)/, '$3-$1-$2')
    }

    const misskeyComment = `
      <article class="misskey-comment">
        <div class="author">
          <div class="avatar">
            <img src="${this.escapeHtml(
              user.avatarUrl,
            )}" height=60 width=60 alt="">
          </div>
          <div class="details">
            <a class="name" href="${user.url}" rel="nofollow">${
              user.name || user.username
            }</a>
            <a class="user" href="${
              user.url
            }" rel="nofollow">${this.user_account(user)}</a>
          </div>
          <a class="date" href="${
            `https://${this.host}/notes/${note.id}`
          }" rel="nofollow">
              <time datetime="${note.createdAt}">
                ${formatDate(note.createdAt)}
              </time>
          </a>
        </div>
        <div class="content">${content}</div>
        <div class="attachments">${attachmentsHtml}</div>
        <div class="status">
          ${this.note_stats(note)}
        </div>
      </article>
    `;

    var li = document.createElement("li");
    li.setAttribute("id", note.id)
    li.innerHTML =
      typeof DOMPurify !== "undefined"
        ? DOMPurify.sanitize(misskeyComment.trim())
        : misskeyComment.trim();
        
    // --- START: Updated logic for Threading/Nesting ---
    if (note.replyId === this.noteId) {
        // This is a top-level reply to the main post
        document.getElementById("misskey-comments-list").appendChild(li);
    } else {
        // This is a reply to another comment (nested)
        let parentElement = document.getElementById(note.replyId);
        if (parentElement) {
            let ul = parentElement.querySelector('ul');
            if (!ul) {
                // If the parent comment doesn't have a reply list yet, create one
                ul = document.createElement('ul');
                parentElement.appendChild(ul);
            }
            ul.appendChild(li);
        } else {
            // Fallback: If parent comment wasn't found (e.g. out of scope/limit),
            // append to the main list (or ignore if strict threading is required)
            // For now, append to main list to avoid losing comments.
            document.getElementById("misskey-comments-list").appendChild(li); 
        }
    }
    // --- END: Updated logic for Threading/Nesting ---


    // Recursive call to render replies to THIS comment
    this.render_notes(notes, note.id);
  }

  loadComments() {
    if (this.commentsLoaded) return;

    document.getElementById("misskey-comments-list").innerHTML =
      "Loading comments from the Fediverse (Misskey)...";

    let _this = this;
    
    // 1. Fetch the main note for its stats (reactions/renotes/repliesCount)
    fetch(`https://${this.host}/api/notes/show`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ noteId: this.noteId })
    })
    .then((response) => response.json())
    .then((note) => {
        if (note && note.id) {
