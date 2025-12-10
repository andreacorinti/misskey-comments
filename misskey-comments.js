const styles = `
:root {
  --font-color: #5d686f;
  --font-size: 1.0rem;

  --block-border-width: 1px;
  --block-border-radius: 3px;
  --block-border-color: #ededf0;
  --block-background-color: #f7f8f8;

  --comment-indent: 40px;
}

misskey-comments {
  font-size: var(--font-size);
}

p {
  margin: 0 0 1rem 0;
}

#misskey-stats {
  text-align: center;
  font-size: calc(var(--font-size) * 1.5);
}

#misskey-title {
  font-size: calc(var(--font-size) * 1.5);
  font-weight: bold;
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
}

.misskey-comment .author .details .user {
  color: #5d686f;
  font-size: medium;
}

.misskey-comment .author .date {
  margin-left: auto;
  font-size: small;
}

.misskey-comment .content {
  margin: 15px 0;
  line-height: 1.5em;
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
  color: #5d686f;
  text-decoration: none;
}

.misskey-comment .status .replies.active a, #misskey-stats .replies.active a {
  color: #003eaa;
}

.misskey-comment .status .reblogs.active a, #misskey-stats .reblogs.active a {
  color: #8c8dff; /* Used for Renotes */
}

.misskey-comment .status .favourites.active a, #misskey-stats .favourites.active a {
  color: #ca8f04; /* Used for Reactions */
}
`;

class MisskeyComments extends HTMLElement {
  constructor() {
    super();

    this.host = this.getAttribute("host");
    this.user = this.getAttribute("user");
    this.noteId = this.getAttribute("noteId"); // Using noteId for Misskey

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
        
    // Logic to insert comment in the list or nested list
    if (note.replyId === this.noteId) {
        document.getElementById("misskey-comments-list").appendChild(li);
    } else {
        const parentNote = notes.find(n => n.id === note.replyId);
        if (parentNote) {
            let parentElement = document.getElementById(note.replyId);
            if (parentElement) {
                let ul = parentElement.querySelector('ul');
                if (!ul) {
                    ul = document.createElement('ul');
                    parentElement.appendChild(ul);
                }
                ul.appendChild(li);
            }
        }
    }

    this.render_notes(notes, note.id);
  }

  loadComments() {
    if (this.commentsLoaded) return;

    document.getElementById("misskey-comments-list").innerHTML =
      "Loading comments from the Fediverse (Misskey)...";

    let _this = this;
    
    // Misskey API requires two separate calls to get stats and context easily.

    // 1. Fetch the main note for its stats (reactions/renotes/repliesCount)
    fetch(`https://${this.host}/api/notes/show`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ noteId: this.noteId })
    })
    .then((response) => response.json())
    .then((note) => {
        if (note && note.id) {
            document.getElementById("misskey-stats").innerHTML =
                this.note_stats(note);
        }
    })
    .catch(error => console.error("Error loading Misskey stats:", error));


    // 2. Fetch the replies (the comments context)
    fetch(
      `https://${this.host}/api/notes/replies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            noteId: this.noteId,
            limit: 100 
        })
    })
      .then((response) => response.json())
      .then((data) => {
        // Misskey returns an array of notes (the descendants) directly
        if (Array.isArray(data) && data.length > 0) {
          document.getElementById("misskey-comments-list").innerHTML = "";
          _this.render_notes(data, _this.noteId);
        } else {
          document.getElementById("misskey-comments-list").innerHTML =
            "<p>No comments found</p>";
        }

        _this.commentsLoaded = true;
      })
      .catch(error => {
          console.error("Error loading Misskey comments:", error);
          document.getElementById("misskey-comments-list").innerHTML =
            "<p>Error loading comments from Misskey.</p>";
      });
  }

  respondToVisibility(element, callback) {
    var options = {
      root: null,
    };

    var observer = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (entry.intersectionRatio > 0) {
          callback();
        }
      });
    }, options);

    observer.observe(element);
  }
}

customElements.define("misskey-comments", MisskeyComments);
