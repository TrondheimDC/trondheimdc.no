---
layout: courses
lang: "no"
title: "Kurs og workshops"
permalink: "/courses/"
nav_active: courses
image_header: "/assets/images/logos/courses.svg"
---

<div class="text-center mb-4">
  <p>I samarbeid med våre partnere, kan vi tilby kurs og workshops i forbindelse med TDC.</p>
  <p>Kursene gjennomføres i dagene etter konferansen. Alle kurs holdes i Trondheim og det er arrangørene som står for lokaler og gjennomføring. Følg lenkene under for mer informasjon og påmelding (eksterne websider).</p>
</div>

<div class="courses-grid mt-2">
  {% assign items = site.data.courses %}
  {% assign count = items | size %}
  {% if count > 0 %}
    {% for c in items %}
    {% assign variant = forloop.index0 | modulo: 3 %}
    <div>
      <a class="course-card-link" href="{{ c.url }}" target="_blank" rel="noopener">
        <div class="card course-card course-card--variant-{{ variant }}">
          <div class="card-body d-flex flex-column">
            <h3 class="card-title">{{ c.title }}</h3>
            <p class="card-text">{{ c.description }}</p>
            <div class="course-meta mt-auto">
              {% if c.organiser %}<div><strong>Arrangør:</strong> {{ c.organiser }}</div>{% endif %}
              {% if c.duration %}<div><strong>Varighet:</strong> {{ c.duration }}</div>{% endif %}
              {% if c.date %}<div><strong>Dato:</strong> {{ c.date }}</div>{% endif %}
            </div>
          </div>
        </div>
      </a>
    </div>
    {% endfor %}
  {% else %}
    {% for i in (1..6) %}
    {% assign variant = forloop.index0 | modulo: 3 %}
    <div>
      <div class="card course-card course-card--variant-{{ variant }}">
        <div class="card-body d-flex flex-column">
          <h3 class="card-title">Kurs tittel {{ i }}</h3>
          <p class="card-text">Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</p>
          <div class="course-meta mt-auto">
            <div><strong>Arrangør:</strong> TBD</div>
            <div><strong>Varighet:</strong> 1 dag</div>
            <div><strong>Dato:</strong> TBD</div>
          </div>
        </div>
      </div>
    </div>
    {% endfor %}
  {% endif %}
</div>
