document.addEventListener('DOMContentLoaded', function () {
    let menuToggle = document.querySelector('.menu-toggle');
    const navigation = document.querySelector('.navigation');
    const navLinks = document.querySelectorAll('.navigation li a');

    // Create menu toggle if it doesn't exist
    if (!menuToggle && navigation) {
        menuToggle = document.createElement('div');
        menuToggle.className = 'menu-toggle';
        menuToggle.innerHTML = '☰'; // standard hamburger character
        menuToggle.style.fontSize = '24px';
        menuToggle.style.cursor = 'pointer';
        const header = document.querySelector('header');
        if (header) {
            header.appendChild(menuToggle);
        }
    }

    // Mobile Menu Toggle
    if (menuToggle && navigation) {
        menuToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            navigation.classList.toggle('active');
        });
        
        // Close menu when clicking outside
        document.addEventListener('click', () => {
            if (navigation.classList.contains('active')) {
                navigation.classList.remove('active');
            }
        });
    }

    // Highlight Active Link
    const currentUrl = window.location.pathname.split('/').pop();
    navLinks.forEach((link) => {
        const href = link.getAttribute('href');
        if (href === currentUrl || (currentUrl === '' && href === 'index.html')) {
            link.classList.add('active');
        }
    });

    // Smooth Scroll Effect for Navigation Links
    // Smooth Scroll Effect for Navigation Links starting with #
    navLinks.forEach(link => {
        link.addEventListener('click', e => {
            const href = link.getAttribute('href');
            if (href && href.startsWith('#')) {
                e.preventDefault();
                const targetId = href.substring(1);
                const targetElement = document.getElementById(targetId);
                if (targetElement) {
                    targetElement.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                }

                // Remove active class from all links
                navLinks.forEach(link => link.classList.remove('active'));

                // Add active class to clicked link
                link.classList.add('active');
            }
        });
    });
});

// Check if dark mode is enabled in localStorage
const currentMode = localStorage.getItem('mode') || 'light';

// Apply the saved mode to the body
if (currentMode === 'dark') {
    document.body.classList.add('dark-mode');
    document.body.classList.add('dark-theme');
}

// Toggle Dark Mode when logo is clicked
document.getElementById('logo').addEventListener('click', function () {
    document.body.classList.toggle('dark-mode');
    document.body.classList.toggle('dark-theme');

    // Save the mode in localStorage
    if (document.body.classList.contains('dark-theme')) {
        localStorage.setItem('mode', 'dark');
    } else {
        localStorage.setItem('mode', 'light');
    }
});
// Scroll Effect for Header
const headerEl = document.querySelector('header');
if (headerEl) {
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            headerEl.classList.add('scrolled');
        } else {
            headerEl.classList.remove('scrolled');
        }
    });
    // Check initial scroll position
    if (window.scrollY > 50) {
        headerEl.classList.add('scrolled');
    }
}
