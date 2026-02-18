---
layout: courses
lang: en
title: "Courses and Workshops"
permalink: "/en/courses/"
nav_active: courses
image_header: "/assets/images/logos/courses.svg"
---

<div class="text-center mb-4">
  <p>In collaboration with our partners, we offer courses and workshops related to TDC.</p>

  <p>The courses take place in the days following the conference. All courses are held in Trondheim, and the organisers are responsible for the venues and delivery. Follow the links below for more information and registration (external websites).</p>
</div>

<div class="courses-grid mt-2">
  {% assign items = site.data.courses_en %}
  {% assign count = items | size %}
  {% if count > 0 %}
    {% for c in items %}
    {% assign variant = forloop.index0 | modulo: 3 %}
    <div>
      <a class="course-card-link" href="{{ c.url }}" target="_blank" rel="noopener">
        <div class="card course-card course-card--variant-{{ variant }}">
          <div class="card-body d-flex flex-column">
            <h5 class="card-title">{{ c.title }}</h5>
            <p class="card-text">{{ c.description }}</p>
            <div class="course-meta mt-auto">
              {% if c.organiser %}<div><strong>Organiser:</strong> {{ c.organiser }}</div>{% endif %}
              {% if c.duration %}<div><strong>Duration:</strong> {{ c.duration }}</div>{% endif %}
              {% if c.date %}<div><strong>Date:</strong> {{ c.date }}</div>{% endif %}
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
          <h5 class="card-title">Course title {{ i }}</h5>
          <p class="card-text">Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</p>
          <div class="course-meta mt-auto">
            <div><strong>Organiser:</strong> TBD</div>
            <div><strong>Duration:</strong> 1 day</div>
            <div><strong>Date:</strong> TBD</div>
          </div>
        </div>
      </div>
    </div>
    {% endfor %}
  {% endif %}
</div>
