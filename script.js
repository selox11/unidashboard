/* script.js - JavaScript for Dashboard Functionality */
/* JavaScript is a programming language that runs in the browser */
/* This file handles the interactive parts of the dashboard page */

const API_URL = '/api/applications'; /* URL for the applications API endpoint */

const applicationsGrid = document.getElementById('applicationsGrid'); /* HTML element where applications are displayed */
const deadlineList = document.getElementById('deadlineList'); /* HTML element for deadline reminders */
const searchInput = document.getElementById('searchInput'); /* Search input field */
const filterButtons = document.querySelectorAll('.filter-btn'); /* Filter buttons (All, Pending, etc.) */
const applicationForm = document.getElementById('applicationForm'); /* Form for adding new applications */
const statusMessage = document.getElementById('statusMessage'); /* Message showing number of applications */

const totalCount = document.getElementById('totalCount'); /* Total applications count */
const pendingCount = document.getElementById('pendingCount'); /* Pending applications count */
const appliedCount = document.getElementById('appliedCount'); /* Applied applications count */
const acceptedCount = document.getElementById('acceptedCount'); /* Accepted applications count */
const rejectedCount = document.getElementById('rejectedCount'); /* Rejected applications count */
const completionText = document.getElementById('completionText'); /* Completion percentage text */
const progressFill = document.getElementById('progressFill'); /* Progress bar fill element */

let applications = []; /* Array to store all applications data */
let activeFilter = 'All'; /* Current active filter (All, Pending, Applied, etc.) */

async function init() { /* Initialize the dashboard - called when page loads */
  try {
    const response = await fetch(API_URL); /* Fetch applications from server */
    if (response.status === 401) { /* If user is not logged in */
      window.location.href = '/login'; /* Redirect to login page */
      return;
    }

    if (!response.ok) { /* If server returned an error */
      throw new Error('Could not load applications.'); /* Throw error */
    }

    applications = await response.json(); /* Parse JSON response into applications array */
    updateDashboard(); /* Update all dashboard elements */
  } catch (error) { /* If there was an error */
    console.error(error); /* Log error to console */
    statusMessage.textContent = 'Could not load application data.'; /* Show error message */
  }
}

function updateDashboard() { /* Update all dashboard components */
  renderStats(); /* Update statistics */
  renderDeadlines(); /* Update deadline list */
  renderApplications(); /* Update applications grid */
}

function renderStats() { /* Update the statistics cards at the top */
  const counts = { /* Count applications by status */
    total: applications.length, /* Total number of applications */
    pending: applications.filter((app) => app.status === 'Pending').length, /* Count pending apps */
    applied: applications.filter((app) => app.status === 'Applied').length, /* Count applied apps */
    accepted: applications.filter((app) => app.status === 'Accepted').length, /* Count accepted apps */
    rejected: applications.filter((app) => app.status === 'Rejected').length, /* Count rejected apps */
  };

  totalCount.textContent = counts.total; /* Update total count display */
  pendingCount.textContent = counts.pending; /* Update pending count display */
  appliedCount.textContent = counts.applied; /* Update applied count display */
  acceptedCount.textContent = counts.accepted; /* Update accepted count display */
  rejectedCount.textContent = counts.rejected; /* Update rejected count display */

  const completed = counts.applied + counts.accepted + counts.rejected; /* Apps that have been decided */
  const completion = counts.total === 0 ? 0 : Math.round((completed / counts.total) * 100); /* Completion percentage */
  completionText.textContent = completion + '%'; /* Update completion text */
  progressFill.style.width = completion + '%'; /* Update progress bar width */
}

function daysUntil(dateString) { /* Calculate days until a deadline */
  const today = new Date(); /* Get today's date */
  today.setHours(0, 0, 0, 0); /* Set time to start of day */

  const target = new Date(dateString); /* Parse the target date */
  target.setHours(0, 0, 0, 0); /* Set time to start of day */

  return Math.ceil((target - today) / (1000 * 60 * 60 * 24)); /* Return days difference */
}

function getDaysClass(days) { /* Get CSS class based on days until deadline */
  if (days <= 7) return 'urgent'; /* Red for very soon */
  if (days <= 21) return 'upcoming'; /* Yellow for soon */
  return 'safe'; /* Green for safe */
}

function formatDate(dateString) { /* Format date for display */
  const date = new Date(dateString); /* Parse the date */
  return new Intl.DateTimeFormat('en-US', { /* Use browser's date formatter */
    year: 'numeric', /* Show year */
    month: 'short', /* Show abbreviated month */
    day: 'numeric', /* Show day */
  }).format(date); /* Return formatted date */
}

function renderDeadlines() { /* Update the deadline reminders section */
  const soonest = [...applications] /* Create copy of applications array */
    .sort((a, b) => new Date(a.deadline) - new Date(b.deadline)) /* Sort by deadline (earliest first) */
    .slice(0, 4); /* Take only the first 4 (soonest deadlines) */

  if (soonest.length === 0) { /* If no applications exist */
    deadlineList.innerHTML = `<div class="deadline-item">No applications yet.</div>`; /* Show message */
    return; /* Exit function */
  }

  deadlineList.innerHTML = soonest /* Generate HTML for each deadline */
    .map((app) => { /* Transform each application into HTML */
      const days = daysUntil(app.deadline); /* Calculate days until deadline */
      const chipClass = getDaysClass(days); /* Get color class for urgency */
      const chipText = days < 0 ? 'Deadline passed' : `${days} day(s) left`; /* Chip text */

      return ` /* Return HTML string for this deadline */
        <article class="deadline-item">
          <h4>${app.university}</h4> /* University name */
          <p>${app.program}</p> /* Program name */
          <p>${formatDate(app.deadline)}</p> /* Formatted deadline date */
          <span class="days-chip ${chipClass}">${chipText}</span> /* Urgency indicator */
        </article>
      `;
    })
    .join(''); /* Join all HTML strings together */
}

function getFilteredApplications() { /* Get applications that match current filter and search */
  const query = searchInput.value.trim().toLowerCase(); /* Get search query, remove spaces, make lowercase */

  return applications.filter((app) => { /* Filter applications array */
    const matchesFilter = activeFilter === 'All' || app.status === activeFilter; /* Check status filter */
    const matchesQuery = /* Check if search query matches */
      query === '' || /* No search query, or matches: */
      app.university.toLowerCase().includes(query) || /* University name */
      app.program.toLowerCase().includes(query) || /* Program name */
      app.country.toLowerCase().includes(query); /* Country name */

    return matchesFilter && matchesQuery; /* Must match both filter and search */
  });
}

function renderApplications() { /* Update the applications grid display */
  const filtered = getFilteredApplications(); /* Get filtered applications */

  if (filtered.length === 0) { /* If no applications match filters */
    applicationsGrid.innerHTML = ` /* Show empty state message */
      <div class="empty-state">
        No applications match your current filter or search.
      </div>
    `;
    statusMessage.textContent = '0 applications shown'; /* Update status message */
    return; /* Exit function */
  }

  applicationsGrid.innerHTML = filtered /* Generate HTML for each application */
    .map( /* Transform each application into HTML card */
      (app) => `
      <article class="application-card"> /* Application card container */
        <div class="card-top"> /* Top section with title and status */
          <div>
            <h3>${app.university}</h3> /* University name */
            <p class="program">${app.program}</p> /* Program name */
          </div>
          <span class="badge ${app.status.toLowerCase()}">${app.status}</span> /* Status badge */
        </div>

        <div class="meta"> /* Metadata section */
          <div class="meta-row"> /* Country row */
            <span>Country</span>
            <strong>${app.country}</strong>
          </div>
          <div class="meta-row"> /* Deadline row */
            <span>Deadline</span>
            <strong>${formatDate(app.deadline)}</strong>
          </div>
        </div>

        <div class="card-actions"> /* Actions section */
          <label> /* Status update dropdown */
            Update status
            <select data-id="${app.id}" class="status-select"> /* Dropdown with app ID */
              ${['Pending', 'Applied', 'Accepted', 'Rejected'] /* All possible statuses */
                .map( /* Create option for each status */
                  (status) => `
                    <option value="${status}" ${status === app.status ? 'selected' : ''}>
                      ${status}
                    </option>
                  `
                )
                .join('')} /* Join all options */
            </select>
          </label>
        </div>

        <div class="note-box"> /* Notes section */
          <strong>Notes:</strong> ${app.notes ? app.notes : 'No notes yet.'} /* Show notes or default text */
        </div>
      </article>
    `
    )
    .join(''); /* Join all card HTML together */

  statusMessage.textContent = `${filtered.length} application(s) shown`; /* Update status message */

  document.querySelectorAll('.status-select').forEach((select) => { /* For each status dropdown */
    select.addEventListener('change', handleStatusChange); /* Add change event listener */
  });
}

async function handleStatusChange(event) { /* Handle when user changes application status */
  const id = Number(event.target.dataset.id); /* Get application ID from dropdown data attribute */
  const newStatus = event.target.value; /* Get new status value */

  const response = await fetch(`${API_URL}/${id}/status`, { /* Send update request to server */
    method: 'POST', /* HTTP POST method */
    headers: { /* Request headers */
      'Content-Type': 'application/json', /* Sending JSON data */
    },
    body: JSON.stringify({ status: newStatus }), /* Convert status to JSON */
  });

  if (response.status === 401) { /* If user not authenticated */
    window.location.href = '/login'; /* Redirect to login */
    return; /* Exit function */
  }

  if (!response.ok) { /* If server error */
    console.error('Unable to update status'); /* Log error */
    return; /* Exit function */
  }

  const updatedApp = await response.json(); /* Get updated application from response */
  applications = applications.map((app) => (app.id === updatedApp.id ? updatedApp : app)); /* Update local array */
  updateDashboard(); /* Refresh all dashboard elements */
}

filterButtons.forEach((button) => { /* For each filter button (All, Pending, etc.) */
  button.addEventListener('click', () => { /* Add click event listener */
    activeFilter = button.dataset.filter; /* Set active filter from button data attribute */
    filterButtons.forEach((btn) => btn.classList.remove('active')); /* Remove active class from all buttons */
    button.classList.add('active'); /* Add active class to clicked button */
    renderApplications(); /* Re-render applications with new filter */
  });
});

searchInput.addEventListener('input', renderApplications); /* Re-render when search input changes */

applicationForm.addEventListener('submit', async (event) => { /* Handle new application form submission */
  event.preventDefault(); /* Prevent page reload */

  const newApplication = { /* Create application object from form data */
    university: document.getElementById('university').value.trim(), /* Get and clean university name */
    program: document.getElementById('program').value.trim(), /* Get and clean program name */
    country: document.getElementById('country').value.trim(), /* Get and clean country name */
    deadline: document.getElementById('deadline').value, /* Get deadline date */
    status: document.getElementById('status').value, /* Get status */
    notes: document.getElementById('notes').value.trim(), /* Get and clean notes */
  };

  const response = await fetch(API_URL, { /* Send new application to server */
    method: 'POST', /* HTTP POST method */
    headers: { /* Request headers */
      'Content-Type': 'application/json', /* Sending JSON data */
    },
    body: JSON.stringify(newApplication), /* Convert application to JSON */
  });

  if (response.status === 401) { /* If user not authenticated */
    window.location.href = '/login'; /* Redirect to login */
    return; /* Exit function */
  }

  if (!response.ok) { /* If server error */
    console.error('Could not add application'); /* Log error */
    return; /* Exit function */
  }

  const createdApplication = await response.json(); /* Get created application from response */
  applications.unshift(createdApplication); /* Add to beginning of applications array */
  applicationForm.reset(); /* Clear the form */
  document.getElementById('status').value = 'Pending'; /* Reset status to default */
  updateDashboard(); /* Refresh all dashboard elements */
});

init(); /* Start the application when page loads */
